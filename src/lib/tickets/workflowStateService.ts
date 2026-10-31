import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export type WorkflowStateCategory = "backlog" | "unstarted" | "started" | "completed" | "cancelled";

export interface WorkflowStateRecord {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  category: WorkflowStateCategory;
  color: string;
  position: number;
  wip_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStateInput {
  userId: string;
  projectId: string;
  name: string;
  category?: WorkflowStateCategory;
  color?: string;
  position?: number;
  wipLimit?: number | null;
}

export interface UpdateStateInput {
  name?: string;
  category?: WorkflowStateCategory;
  color?: string;
  wipLimit?: number | null;
  position?: number;
}

export class WorkflowStateService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Initializes default workflow states for a project if none exist:
   * Backlog, Todo, In Progress, Done.
   */
  ensureDefaultStates(projectId: string, userId: string): WorkflowStateRecord[] {
    const existing = this.db.prepare(
      "SELECT id FROM workflow_states WHERE project_id = ? AND user_id = ? ORDER BY position ASC"
    ).all(projectId, userId);

    if (existing.length > 0) {
      return this.listStates(projectId, userId);
    }

    const defaultColumns: Array<{ name: string; category: WorkflowStateCategory; color: string; wip: number | null }> = [
      { name: "Backlog", category: "backlog", color: "#64748B", wip: null },
      { name: "Todo", category: "unstarted", color: "#3B82F6", wip: null },
      { name: "In Progress", category: "started", color: "#F59E0B", wip: 5 },
      { name: "Done", category: "completed", color: "#10B981", wip: null },
    ];

    const now = new Date().toISOString();
    const insertStmt = this.db.prepare(`
      INSERT INTO workflow_states (
        id, user_id, project_id, name, category, color, position, wip_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const txn = this.db.transaction(() => {
      defaultColumns.forEach((col, idx) => {
        insertStmt.run(
          crypto.randomUUID(),
          userId,
          projectId,
          col.name,
          col.category,
          col.color,
          idx,
          col.wip,
          now,
          now
        );
      });
    });

    txn();
    return this.listStates(projectId, userId);
  }

  /**
   * Lists all workflow states for a project in ascending position order.
   */
  listStates(projectId: string, userId: string): WorkflowStateRecord[] {
    const rows = this.db.prepare(`
      SELECT id, user_id, project_id, name, category, color, position, wip_limit, created_at, updated_at
      FROM workflow_states
      WHERE project_id = ? AND user_id = ?
      ORDER BY position ASC
    `).all(projectId, userId) as WorkflowStateRecord[];

    if (rows.length === 0) {
      // Check if project exists first
      const proj = this.db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId);
      if (proj) {
        return this.ensureDefaultStates(projectId, userId);
      }
    }

    return rows;
  }

  /**
   * Retrieves a single workflow state by ID, verifying user ownership.
   */
  getState(stateId: string, userId: string): WorkflowStateRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id, project_id, name, category, color, position, wip_limit, created_at, updated_at
      FROM workflow_states
      WHERE id = ? AND user_id = ?
    `).get(stateId, userId);

    return (row as WorkflowStateRecord) ?? null;
  }

  /**
   * Creates a new custom workflow state.
   */
  createState(input: CreateStateInput): WorkflowStateRecord {
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 50) {
      throw new Error("Workflow state name must be between 1 and 50 characters");
    }

    // Verify project access
    const project = this.db.prepare(
      "SELECT id FROM projects WHERE id = ? AND user_id = ?"
    ).get(input.projectId, input.userId);
    if (!project) throw new Error("Project not found or access denied");

    let position = input.position;
    if (position === undefined) {
      const maxRow = this.db.prepare(
        "SELECT MAX(position) as maxPos FROM workflow_states WHERE project_id = ? AND user_id = ?"
      ).get(input.projectId, input.userId) as { maxPos: number | null };
      position = (maxRow?.maxPos ?? -1) + 1;
    }

    const stateId = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = input.category || "unstarted";
    const color = input.color || "#3B82F6";
    const wipLimit = input.wipLimit !== undefined ? input.wipLimit : null;

    if (wipLimit !== null && (wipLimit < 1 || !Number.isInteger(wipLimit))) {
      throw new Error("WIP limit must be an integer of 1 or greater");
    }

    this.db.prepare(`
      INSERT INTO workflow_states (
        id, user_id, project_id, name, category, color, position, wip_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      stateId,
      input.userId,
      input.projectId,
      trimmedName,
      category,
      color,
      position,
      wipLimit,
      now,
      now
    );

    const created = this.getState(stateId, input.userId);
    if (!created) throw new Error("Failed to retrieve created workflow state");
    return created;
  }

  /**
   * Updates an existing workflow state.
   */
  updateState(stateId: string, userId: string, updates: UpdateStateInput): WorkflowStateRecord {
    const existing = this.getState(stateId, userId);
    if (!existing) throw new Error("Workflow state not found or access denied");

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    if (name.length < 1 || name.length > 50) {
      throw new Error("Workflow state name must be between 1 and 50 characters");
    }

    const category = updates.category !== undefined ? updates.category : existing.category;
    const color = updates.color !== undefined ? updates.color : existing.color;
    const position = updates.position !== undefined ? updates.position : existing.position;
    const wipLimit = updates.wipLimit !== undefined ? updates.wipLimit : existing.wip_limit;

    if (wipLimit !== null && (wipLimit < 1 || !Number.isInteger(wipLimit))) {
      throw new Error("WIP limit must be an integer of 1 or greater");
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE workflow_states
      SET name = ?, category = ?, color = ?, position = ?, wip_limit = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(name, category, color, position, wipLimit, now, stateId, userId);

    const updated = this.getState(stateId, userId);
    if (!updated) throw new Error("Failed to retrieve updated workflow state");
    return updated;
  }

  /**
   * Reorders workflow states according to an array of state IDs.
   */
  reorderStates(projectId: string, userId: string, stateIdsInOrder: string[]): void {
    const now = new Date().toISOString();
    const updateStmt = this.db.prepare(
      "UPDATE workflow_states SET position = ?, updated_at = ? WHERE id = ? AND project_id = ? AND user_id = ?"
    );

    const txn = this.db.transaction(() => {
      stateIdsInOrder.forEach((id, index) => {
        updateStmt.run(index, now, id, projectId, userId);
      });
    });

    txn();
  }

  /**
   * Safely deletes a workflow state (KANB-05).
   * If tickets currently reside in stateId, targetStateId must be supplied,
   * migrating all tickets to targetStateId before deleting stateId.
   */
  deleteState(
    stateId: string,
    userId: string,
    targetStateId?: string
  ): { migratedTicketsCount: number } {
    const existing = this.getState(stateId, userId);
    if (!existing) throw new Error("Workflow state not found");

    // Cannot delete if it is the only state in the project
    const allStates = this.listStates(existing.project_id, userId);
    if (allStates.length <= 1) {
      throw new Error("Cannot delete the only workflow state in a project");
    }

    // Check ticket count
    const countRow = this.db.prepare(
      "SELECT COUNT(*) as count FROM tickets WHERE workflow_state_id = ? AND user_id = ?"
    ).get(stateId, userId) as { count: number };
    const ticketCount = countRow?.count ?? 0;

    if (ticketCount > 0) {
      if (!targetStateId) {
        throw new Error(
          `Cannot delete state with ${ticketCount} tickets without specifying a target state`
        );
      }
      if (targetStateId === stateId) {
        throw new Error("Target migration state cannot be the state being deleted");
      }
      const targetState = this.getState(targetStateId, userId);
      if (!targetState || targetState.project_id !== existing.project_id) {
        throw new Error("Target migration state not found or in different project");
      }

      const now = new Date().toISOString();
      const txn = this.db.transaction(() => {
        // 1. Migrate tickets
        this.db.prepare(`
          UPDATE tickets
          SET workflow_state_id = ?, updated_at = ?
          WHERE workflow_state_id = ? AND user_id = ?
        `).run(targetStateId, now, stateId, userId);

        // 2. Delete the state
        this.db.prepare("DELETE FROM workflow_states WHERE id = ? AND user_id = ?").run(stateId, userId);
      });

      txn();
      return { migratedTicketsCount: ticketCount };
    }

    // No tickets, delete directly
    this.db.prepare("DELETE FROM workflow_states WHERE id = ? AND user_id = ?").run(stateId, userId);
    return { migratedTicketsCount: 0 };
  }
}
