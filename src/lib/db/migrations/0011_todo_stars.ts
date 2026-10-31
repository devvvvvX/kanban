import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0011: Migration = {
  version: 11,
  name: "todo_stars",
  up: (db: ISqlDatabase) => {
    try {
      db.exec(`ALTER TABLE todos ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0;`);
    } catch {
      // Column already exists
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_starred ON todos(user_id, is_starred);
    `);
  },
  down: () => {
    // SQLite doesn't support DROP COLUMN in older versions; no-op
  },
};
