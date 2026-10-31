import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface Subtask {
  id: string;
  ticket_id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface SubtaskProgress {
  total: number;
  completed: number;
  percentage: number;
}

export class SubtaskService {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  public getSubtasks(userId: string, ticketId: string): Subtask[] {
    const rows = this.db
      .prepare(
        `SELECT id, ticket_id, user_id, title, is_completed, position, created_at, updated_at
         FROM subtasks
         WHERE user_id = ? AND ticket_id = ?
         ORDER BY position ASC, created_at ASC`
      )
      .all(userId, ticketId) as Array<{
        id: string;
        ticket_id: string;
        user_id: string;
        title: string;
        is_completed: number;
        position: number;
        created_at: string;
        updated_at: string;
      }>;

    return rows.map((r) => ({
      ...r,
      is_completed: Boolean(r.is_completed),
    }));
  }

  public createSubtask(userId: string, ticketId: string, title: string): Subtask {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error("Subtask title cannot be empty");
    }

    // Verify ticket ownership
    const ticket = this.db
      .prepare("SELECT id FROM tickets WHERE id = ? AND user_id = ?")
      .get(ticketId, userId);
    if (!ticket) {
      throw new Error("Ticket not found or unauthorized");
    }

    // Get max position
    const maxPosRow = this.db
      .prepare("SELECT MAX(position) as maxPos FROM subtasks WHERE ticket_id = ?")
      .get(ticketId) as { maxPos: number | null };
    const position = (maxPosRow?.maxPos ?? 0) + 1000;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO subtasks (id, ticket_id, user_id, title, is_completed, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(id, ticketId, userId, trimmed, position, now, now);

    return {
      id,
      ticket_id: ticketId,
      user_id: userId,
      title: trimmed,
      is_completed: false,
      position,
      created_at: now,
      updated_at: now,
    };
  }

  public updateSubtask(
    userId: string,
    subtaskId: string,
    updates: { title?: string; is_completed?: boolean }
  ): Subtask {
    const existing = this.db
      .prepare("SELECT * FROM subtasks WHERE id = ? AND user_id = ?")
      .get(subtaskId, userId) as {
        id: string;
        ticket_id: string;
        user_id: string;
        title: string;
        is_completed: number;
        position: number;
        created_at: string;
        updated_at: string;
      } | undefined;

    if (!existing) {
      throw new Error("Subtask not found or unauthorized");
    }

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (!title) {
      throw new Error("Subtask title cannot be empty");
    }
    const isCompleted =
      updates.is_completed !== undefined ? (updates.is_completed ? 1 : 0) : existing.is_completed;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE subtasks
         SET title = ?, is_completed = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(title, isCompleted, now, subtaskId, userId);

    return {
      id: existing.id,
      ticket_id: existing.ticket_id,
      user_id: existing.user_id,
      title,
      is_completed: Boolean(isCompleted),
      position: existing.position,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  public toggleCompletion(userId: string, subtaskId: string): Subtask {
    const existing = this.db
      .prepare("SELECT * FROM subtasks WHERE id = ? AND user_id = ?")
      .get(subtaskId, userId) as { is_completed: number } | undefined;

    if (!existing) {
      throw new Error("Subtask not found or unauthorized");
    }

    const newCompleted = existing.is_completed === 1 ? false : true;
    return this.updateSubtask(userId, subtaskId, { is_completed: newCompleted });
  }

  public reorderSubtasks(userId: string, ticketId: string, subtaskIds: string[]): void {
    const stmt = this.db.prepare(
      "UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ? AND user_id = ? AND ticket_id = ?"
    );
    const now = new Date().toISOString();

    const txn = this.db.transaction(() => {
      subtaskIds.forEach((id, index) => {
        const position = (index + 1) * 1000;
        stmt.run(position, now, id, userId, ticketId);
      });
    });

    txn();
  }

  public deleteSubtask(userId: string, subtaskId: string): void {
    const res = this.db
      .prepare("DELETE FROM subtasks WHERE id = ? AND user_id = ?")
      .run(subtaskId, userId);
    if (res.changes === 0) {
      throw new Error("Subtask not found or unauthorized");
    }
  }

  public getProgress(userId: string, ticketId: string): SubtaskProgress {
    const rows = this.db
      .prepare(
        `SELECT is_completed FROM subtasks WHERE user_id = ? AND ticket_id = ?`
      )
      .all(userId, ticketId) as Array<{ is_completed: number }>;

    const total = rows.length;
    if (total === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    const completed = rows.filter((r) => r.is_completed === 1).length;
    const percentage = Math.round((completed / total) * 100);

    return { total, completed, percentage };
  }

  public getAllProgress(userId: string): Record<string, { total: number; completed: number }> {
    const rows = this.db
      .prepare(
        `SELECT ticket_id,
                COUNT(*) as total,
                SUM(is_completed) as completed
         FROM subtasks
         WHERE user_id = ?
         GROUP BY ticket_id`
      )
      .all(userId) as Array<{ ticket_id: string; total: number; completed: number | null }>;

    const map: Record<string, { total: number; completed: number }> = {};
    for (const r of rows) {
      map[r.ticket_id] = {
        total: r.total,
        completed: r.completed ?? 0,
      };
    }
    return map;
  }
}
