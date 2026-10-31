import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0009: Migration = {
  version: 9,
  name: "attachments_and_notes",
  up: (db: ISqlDatabase) => {
    // 1. Ticket Attachments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        data_url TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_user ON ticket_attachments(user_id);
    `);

    // 2. Personal Notes and Scratchpad table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        color TEXT DEFAULT '#3B82F6',
        is_pinned INTEGER NOT NULL DEFAULT 0,
        whiteboard_data TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS notes;
      DROP TABLE IF EXISTS ticket_attachments;
    `);
  },
};
