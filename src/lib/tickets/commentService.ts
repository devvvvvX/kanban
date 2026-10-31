import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export class CommentService {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  public addComment(userId: string, ticketId: string, content: string): TicketComment {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Comment content cannot be empty");
    }

    // Verify ticket exists
    const ticket = this.db
      .prepare("SELECT id FROM tickets WHERE id = ? AND user_id = ?")
      .get(ticketId, userId);
    if (!ticket) {
      throw new Error("Ticket not found or unauthorized");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO ticket_comments (id, ticket_id, user_id, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, ticketId, userId, trimmed, now, now);

    return {
      id,
      ticket_id: ticketId,
      user_id: userId,
      content: trimmed,
      created_at: now,
      updated_at: now,
    };
  }

  public updateComment(userId: string, commentId: string, content: string): TicketComment {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Comment content cannot be empty");
    }

    const existing = this.db
      .prepare("SELECT * FROM ticket_comments WHERE id = ? AND user_id = ?")
      .get(commentId, userId) as TicketComment | undefined;

    if (!existing) {
      throw new Error("Comment not found or unauthorized");
    }

    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE ticket_comments SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(trimmed, now, commentId, userId);

    return {
      ...existing,
      content: trimmed,
      updated_at: now,
    };
  }

  public deleteComment(userId: string, commentId: string): void {
    const res = this.db
      .prepare("DELETE FROM ticket_comments WHERE id = ? AND user_id = ?")
      .run(commentId, userId);

    if (res.changes === 0) {
      throw new Error("Comment not found or unauthorized");
    }
  }

  public listComments(userId: string, ticketId: string): TicketComment[] {
    const rows = this.db
      .prepare(
        `SELECT id, ticket_id, user_id, content, created_at, updated_at
         FROM ticket_comments
         WHERE user_id = ? AND ticket_id = ?
         ORDER BY created_at ASC`
      )
      .all(userId, ticketId) as TicketComment[];

    return rows;
  }
}
