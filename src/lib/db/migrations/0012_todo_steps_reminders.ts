import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0012: Migration = {
  version: 12,
  name: "todo_steps_reminders",
  up: (db: ISqlDatabase) => {
    try {
      db.exec(`ALTER TABLE todos ADD COLUMN steps TEXT DEFAULT '[]';`);
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE todos ADD COLUMN remind_at TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE todos ADD COLUMN reminder_sent INTEGER NOT NULL DEFAULT 0;`);
    } catch {
      // Column already exists
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_remind ON todos(user_id, remind_at);
    `);
  },
  down: () => {
    // No-op for SQLite column drop
  },
};

