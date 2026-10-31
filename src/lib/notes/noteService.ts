import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import { TicketService, type TicketRecord } from "../tickets/ticketService";
import { WorkflowStateService } from "../tickets/workflowStateService";

export interface NoteRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  content: string;
  color: string;
  is_pinned: number;
  whiteboard_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  projectId?: string | null;
  color?: string;
  isPinned?: boolean;
  whiteboardData?: string | null;
  whiteboard_data?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  projectId?: string | null;
  color?: string;
  isPinned?: boolean;
  whiteboardData?: string | null;
  whiteboard_data?: string | null;
}

export interface ConvertNoteToTicketInput {
  noteId: string;
  projectId: string;
  workflowStateId?: string;
  priority?: "none" | "low" | "medium" | "high" | "urgent";
  customTitle?: string;
}

export class NoteService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  public createNote(input: CreateNoteInput, userId: string): NoteRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const color = input.color || "#3B82F6";
    const isPinned = input.isPinned ? 1 : 0;
    const content = input.content || "";
    const title = input.title.trim() || "Untitled Note";

    const stmt = this.db.prepare(`
      INSERT INTO notes (id, user_id, project_id, title, content, color, is_pinned, whiteboard_data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const whiteboardData =
      input.whiteboardData !== undefined
        ? input.whiteboardData
        : input.whiteboard_data !== undefined
        ? input.whiteboard_data
        : null;

    stmt.run(
      id,
      userId,
      input.projectId || null,
      title,
      content,
      color,
      isPinned,
      whiteboardData,
      now,
      now
    );

    return {
      id,
      user_id: userId,
      project_id: input.projectId || null,
      title,
      content,
      color,
      is_pinned: isPinned,
      whiteboard_data: whiteboardData,
      created_at: now,
      updated_at: now,
    };
  }

  public getNote(noteId: string, userId: string): NoteRecord | null {
    const stmt = this.db.prepare(`
      SELECT id, user_id, project_id, title, content, color, is_pinned, whiteboard_data, created_at, updated_at
      FROM notes
      WHERE id = ? AND user_id = ?
    `);

    return (stmt.get(noteId, userId) as NoteRecord) ?? null;
  }

  public listNotes(userId: string, projectId?: string): NoteRecord[] {
    let sql = `
      SELECT id, user_id, project_id, title, content, color, is_pinned, whiteboard_data, created_at, updated_at
      FROM notes
      WHERE user_id = ?
    `;
    const params: unknown[] = [userId];

    if (projectId) {
      sql += " AND project_id = ?";
      params.push(projectId);
    }

    sql += " ORDER BY is_pinned DESC, updated_at DESC";

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as NoteRecord[];
  }

  public updateNote(noteId: string, updates: UpdateNoteInput, userId: string): NoteRecord {
    const existing = this.getNote(noteId, userId);
    if (!existing) {
      throw new Error(`Note not found or access denied: ${noteId}`);
    }

    const title = updates.title !== undefined ? updates.title.trim() || "Untitled Note" : existing.title;
    const content = updates.content !== undefined ? updates.content : existing.content;
    const projectId = updates.projectId !== undefined ? updates.projectId : existing.project_id;
    const color = updates.color !== undefined ? updates.color : existing.color;
    const isPinned = updates.isPinned !== undefined ? (updates.isPinned ? 1 : 0) : existing.is_pinned;
    const whiteboardData =
      updates.whiteboardData !== undefined
        ? updates.whiteboardData
        : updates.whiteboard_data !== undefined
        ? updates.whiteboard_data
        : existing.whiteboard_data;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, project_id = ?, color = ?, is_pinned = ?, whiteboard_data = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(title, content, projectId, color, isPinned, whiteboardData, now, noteId, userId);

    return {
      id: noteId,
      user_id: userId,
      project_id: projectId,
      title,
      content,
      color,
      is_pinned: isPinned,
      whiteboard_data: whiteboardData,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  public deleteNote(noteId: string, userId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM notes
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(noteId, userId);
    return true;
  }

  public convertNoteToTicket(input: ConvertNoteToTicketInput, userId: string): TicketRecord {
    const note = this.getNote(input.noteId, userId);
    if (!note) {
      throw new Error(`Note not found: ${input.noteId}`);
    }

    const stateService = new WorkflowStateService(this.db);
    let targetStateId = input.workflowStateId;
    if (!targetStateId) {
      const states = stateService.listStates(input.projectId, userId);
      const defaultState = states.find((s) => s.category === "unstarted" || s.category === "backlog") || states[0];
      if (!defaultState) {
        throw new Error(`No workflow states found for project ${input.projectId}`);
      }
      targetStateId = defaultState.id;
    }

    const ticketService = new TicketService(this.db);
    const title = input.customTitle?.trim() || note.title;
    const description = note.content;

    const createdTicket = ticketService.createTicket({
      projectId: input.projectId,
      workflowStateId: targetStateId,
      title,
      description: description || undefined,
      priority: input.priority || "none",
      userId,
    });

    return createdTicket;
  }
}
