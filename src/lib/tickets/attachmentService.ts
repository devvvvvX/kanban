import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  data_url: string;
  created_at: string;
}

export interface CreateAttachmentInput {
  ticketId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
}

export class AttachmentService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  public addAttachment(input: CreateAttachmentInput, userId: string): TicketAttachment {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO ticket_attachments (id, ticket_id, user_id, file_name, file_type, file_size, data_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.ticketId,
      userId,
      input.fileName,
      input.fileType,
      input.fileSize,
      input.dataUrl,
      now
    );

    return {
      id,
      ticket_id: input.ticketId,
      user_id: userId,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      data_url: input.dataUrl,
      created_at: now,
    };
  }

  public listAttachments(ticketId: string, userId: string): TicketAttachment[] {
    const stmt = this.db.prepare(`
      SELECT id, ticket_id, user_id, file_name, file_type, file_size, data_url, created_at
      FROM ticket_attachments
      WHERE ticket_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(ticketId, userId) as TicketAttachment[];
  }

  public getAttachment(attachmentId: string, userId: string): TicketAttachment | null {
    const stmt = this.db.prepare(`
      SELECT id, ticket_id, user_id, file_name, file_type, file_size, data_url, created_at
      FROM ticket_attachments
      WHERE id = ? AND user_id = ?
    `);

    return (stmt.get(attachmentId, userId) as TicketAttachment) ?? null;
  }

  public deleteAttachment(attachmentId: string, userId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM ticket_attachments
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(attachmentId, userId);
    return true;
  }
}
