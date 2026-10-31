import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import { WorkflowStateService } from "./workflowStateService";

export type TicketPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface TicketRecord {
  id: string;
  user_id: string;
  project_id: string;
  epic_id: string | null;
  workflow_state_id: string;
  parent_id: string | null;
  ticket_number: number;
  identifier: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  labels: string[];
  due_date: string | null;
  estimate: number | null;
  position: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  userId: string;
  projectId: string;
  workflowStateId?: string;
  epicId?: string | null;
  parentId?: string | null;
  title: string;
  description?: string;
  priority?: TicketPriority;
  labels?: string[];
  dueDate?: string | null;
  estimate?: number | null;
  position?: number;
}

export interface UpdateTicketInput {
  workflowStateId?: string;
  epicId?: string | null;
  parentId?: string | null;
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  labels?: string[];
  dueDate?: string | null;
  estimate?: number | null;
  position?: number;
}

export interface ListTicketsOptions {
  workflowStateId?: string;
  epicId?: string;
  priority?: TicketPriority;
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

export class TicketService {
  private db: ISqlDatabase;
  private workflowStateService: WorkflowStateService;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
    this.workflowStateService = new WorkflowStateService(this.db);
  }

  /**
   * Generates a concise project key prefix (e.g. "Distributed KV" -> "DKV", "Kanban" -> "KAN")
   */
  public generateProjectKey(projectName: string): string {
    const words = projectName
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    if (words.length >= 2) {
      const letters = words.map((w) => w[0].toUpperCase()).join("");
      if (letters.length >= 3) return letters.slice(0, 4);
      // Pad with subsequent letters of first word
      const pad = words[0].slice(1, 4 - letters.length).toUpperCase();
      return (letters + pad).padEnd(3, "X");
    }

    const single = words[0] || "PRJ";
    return single.slice(0, 3).toUpperCase().padEnd(3, "X");
  }

  /**
   * Creates a new ticket with automatic human-readable identifier (TICK-01, TICK-02, TICK-03).
   */
  createTicket(input: CreateTicketInput): TicketRecord {
    const trimmedTitle = input.title?.trim();
    if (!trimmedTitle || trimmedTitle.length < 1 || trimmedTitle.length > 200) {
      throw new Error("Ticket title must be between 1 and 200 characters");
    }

    // Verify project exists and belongs to user
    const project = this.db.prepare(
      "SELECT id, name FROM projects WHERE id = ? AND user_id = ?"
    ).get(input.projectId, input.userId) as { id: string; name: string } | undefined;

    if (!project) {
      throw new Error("Project not found or access denied");
    }

    // Determine workflow state: use provided or find first default state
    let workflowStateId = input.workflowStateId;
    if (!workflowStateId) {
      const states = this.workflowStateService.listStates(input.projectId, input.userId);
      if (states.length === 0) {
        throw new Error("Project has no workflow states configured");
      }
      workflowStateId = states[0].id;
    } else {
      const state = this.workflowStateService.getState(workflowStateId, input.userId);
      if (!state || state.project_id !== input.projectId) {
        throw new Error("Workflow state not found or in different project");
      }
    }

    // Verify epic if provided
    if (input.epicId) {
      const epic = this.db.prepare(
        "SELECT id FROM epics WHERE id = ? AND project_id = ? AND user_id = ?"
      ).get(input.epicId, input.projectId, input.userId);
      if (!epic) throw new Error("Epic not found or in different project");
    }

    // Next sequential ticket number in this project
    const nextNumRow = this.db.prepare(
      "SELECT COALESCE(MAX(ticket_number), 0) + 1 as nextNum FROM tickets WHERE project_id = ?"
    ).get(input.projectId) as { nextNum: number };
    const ticketNumber = nextNumRow.nextNum;

    const projectKey = this.generateProjectKey(project.name);
    const identifier = `${projectKey}-${ticketNumber}`;

    // Determine position in column
    let position = input.position;
    if (position === undefined) {
      const posRow = this.db.prepare(
        "SELECT COALESCE(MAX(position), 0) + 1 as nextPos FROM tickets WHERE workflow_state_id = ?"
      ).get(workflowStateId) as { nextPos: number };
      position = posRow.nextPos;
    }

    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority: TicketPriority = input.priority || "none";
    const labelsJson = JSON.stringify(input.labels || []);
    const description = input.description?.trim() || null;
    const dueDate = input.dueDate || null;
    const estimate = input.estimate !== undefined ? input.estimate : null;

    this.db.prepare(`
      INSERT INTO tickets (
        id, user_id, project_id, epic_id, workflow_state_id, parent_id,
        ticket_number, identifier, title, description, priority, labels,
        due_date, estimate, position, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      ticketId,
      input.userId,
      input.projectId,
      input.epicId || null,
      workflowStateId,
      input.parentId || null,
      ticketNumber,
      identifier,
      trimmedTitle,
      description,
      priority,
      labelsJson,
      dueDate,
      estimate,
      position,
      now,
      now
    );

    const created = this.getTicket(ticketId, input.userId);
    if (!created) throw new Error("Failed to retrieve created ticket");
    return created;
  }

  /**
   * Retrieves a single ticket by ID, parsing labels JSON and verifying user ownership.
   */
  getTicket(ticketId: string, userId: string): TicketRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id, project_id, epic_id, workflow_state_id, parent_id,
             ticket_number, identifier, title, description, priority, labels,
             due_date, estimate, position, is_archived, created_at, updated_at
      FROM tickets
      WHERE id = ? AND user_id = ?
    `).get(ticketId, userId) as any;

    if (!row) return null;

    let parsedLabels: string[] = [];
    try {
      parsedLabels = JSON.parse(row.labels || "[]");
    } catch {
      parsedLabels = [];
    }

    return {
      ...row,
      labels: parsedLabels,
    };
  }

  /**
   * Retrieves a single ticket by human-readable identifier (e.g. KAN-12).
   */
  getTicketByIdentifier(projectId: string, identifier: string, userId: string): TicketRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id, project_id, epic_id, workflow_state_id, parent_id,
             ticket_number, identifier, title, description, priority, labels,
             due_date, estimate, position, is_archived, created_at, updated_at
      FROM tickets
      WHERE project_id = ? AND identifier = ? AND user_id = ?
    `).get(projectId, identifier, userId) as any;

    if (!row) return null;

    let parsedLabels: string[] = [];
    try {
      parsedLabels = JSON.parse(row.labels || "[]");
    } catch {
      parsedLabels = [];
    }

    return {
      ...row,
      labels: parsedLabels,
    };
  }

  /**
   * Lists tickets for a project with optional filtering.
   */
  listTickets(projectId: string, userId: string, options?: ListTicketsOptions): TicketRecord[] {
    let query = "SELECT * FROM tickets WHERE project_id = ? AND user_id = ?";
    const params: any[] = [projectId, userId];

    if (options?.onlyArchived) {
      query += " AND is_archived = 1";
    } else if (!options?.includeArchived) {
      query += " AND is_archived = 0";
    }

    if (options?.workflowStateId) {
      query += " AND workflow_state_id = ?";
      params.push(options.workflowStateId);
    }

    if (options?.epicId) {
      query += " AND epic_id = ?";
      params.push(options.epicId);
    }

    if (options?.priority) {
      query += " AND priority = ?";
      params.push(options.priority);
    }

    query += " ORDER BY position ASC, created_at ASC";

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((r) => {
      let labels: string[] = [];
      try {
        labels = JSON.parse(r.labels || "[]");
      } catch {
        labels = [];
      }
      return {
        ...r,
        labels,
      };
    });
  }

  /**
   * Lists archived tickets for a user, optionally filtered by project (TICK-05).
   */
  listArchivedTickets(userId: string, projectId?: string): TicketRecord[] {
    let query = "SELECT * FROM tickets WHERE user_id = ? AND is_archived = 1";
    const params: any[] = [userId];

    if (projectId) {
      query += " AND project_id = ?";
      params.push(projectId);
    }

    query += " ORDER BY updated_at DESC";

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((r) => {
      let labels: string[] = [];
      try {
        labels = JSON.parse(r.labels || "[]");
      } catch {
        labels = [];
      }
      return {
        ...r,
        labels,
      };
    });
  }

  /**
   * Updates an existing ticket (TICK-03, TICK-04).
   */
  updateTicket(ticketId: string, userId: string, updates: UpdateTicketInput): TicketRecord {
    const existing = this.getTicket(ticketId, userId);
    if (!existing) throw new Error("Ticket not found or access denied");

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (title.length < 1 || title.length > 200) {
      throw new Error("Ticket title must be between 1 and 200 characters");
    }

    const workflowStateId = updates.workflowStateId !== undefined ? updates.workflowStateId : existing.workflow_state_id;
    if (updates.workflowStateId && updates.workflowStateId !== existing.workflow_state_id) {
      const state = this.workflowStateService.getState(updates.workflowStateId, userId);
      if (!state || state.project_id !== existing.project_id) {
        throw new Error("Target workflow state not found or in different project");
      }
    }

    const epicId = updates.epicId !== undefined ? updates.epicId : existing.epic_id;
    const parentId = updates.parentId !== undefined ? updates.parentId : existing.parent_id;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const priority = updates.priority !== undefined ? updates.priority : existing.priority;
    const labelsJson = updates.labels !== undefined ? JSON.stringify(updates.labels) : JSON.stringify(existing.labels);
    const dueDate = updates.dueDate !== undefined ? updates.dueDate : existing.due_date;
    const estimate = updates.estimate !== undefined ? updates.estimate : existing.estimate;
    const position = updates.position !== undefined ? updates.position : existing.position;
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE tickets
      SET title = ?, workflow_state_id = ?, epic_id = ?, parent_id = ?,
          description = ?, priority = ?, labels = ?, due_date = ?,
          estimate = ?, position = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title,
      workflowStateId,
      epicId,
      parentId,
      description,
      priority,
      labelsJson,
      dueDate,
      estimate,
      position,
      now,
      ticketId,
      userId
    );

    const updated = this.getTicket(ticketId, userId);
    if (!updated) throw new Error("Failed to retrieve updated ticket");
    return updated;
  }

  /**
   * Moves a ticket to a new column and/or updates its position (KANB-04).
   */
  moveTicket(ticketId: string, userId: string, targetStateId: string, newPosition?: number): TicketRecord {
    const existing = this.getTicket(ticketId, userId);
    if (!existing) throw new Error("Ticket not found");

    let pos = newPosition;
    if (pos === undefined) {
      const posRow = this.db.prepare(
        "SELECT COALESCE(MAX(position), 0) + 1 as nextPos FROM tickets WHERE workflow_state_id = ?"
      ).get(targetStateId) as { nextPos: number };
      pos = posRow.nextPos;
    }

    return this.updateTicket(ticketId, userId, {
      workflowStateId: targetStateId,
      position: pos,
    });
  }

  /**
   * Duplicates an existing ticket with "(Copy)" suffix (TICK-05).
   */
  duplicateTicket(ticketId: string, userId: string): TicketRecord {
    const existing = this.getTicket(ticketId, userId);
    if (!existing) throw new Error("Ticket not found");

    return this.createTicket({
      userId,
      projectId: existing.project_id,
      workflowStateId: existing.workflow_state_id,
      epicId: existing.epic_id,
      parentId: existing.parent_id,
      title: `${existing.title} (Copy)`,
      description: existing.description || undefined,
      priority: existing.priority,
      labels: [...existing.labels],
      dueDate: existing.due_date,
      estimate: existing.estimate,
    });
  }

  /**
   * Archives a ticket (TICK-05).
   */
  archiveTicket(ticketId: string, userId: string): void {
    const existing = this.getTicket(ticketId, userId);
    if (!existing) throw new Error("Ticket not found");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE tickets SET is_archived = 1, updated_at = ? WHERE id = ? AND user_id = ?").run(
      now,
      ticketId,
      userId
    );
  }

  /**
   * Restores an archived ticket (TICK-05).
   */
  restoreTicket(ticketId: string, userId: string): void {
    const existing = this.getTicket(ticketId, userId);
    if (!existing) throw new Error("Ticket not found");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE tickets SET is_archived = 0, updated_at = ? WHERE id = ? AND user_id = ?").run(
      now,
      ticketId,
      userId
    );
  }

  /**
   * Permanently deletes a ticket (TICK-05).
   */
  deleteTicket(ticketId: string, userId: string): void {
    const existing = this.getTicket(ticketId, userId);
    if (!existing) throw new Error("Ticket not found");
    this.db.prepare("DELETE FROM tickets WHERE id = ? AND user_id = ?").run(ticketId, userId);
  }
}
