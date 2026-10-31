import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0010: Migration = {
  version: 10,
  name: "todos",
  up: (db: ISqlDatabase) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        notes TEXT,
        cadence TEXT NOT NULL DEFAULT 'daily',
        custom_list TEXT,
        target_date TEXT,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        priority TEXT NOT NULL DEFAULT 'none',
        order_index INTEGER NOT NULL DEFAULT 0,
        converted_ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
      CREATE INDEX IF NOT EXISTS idx_todos_user_cadence ON todos(user_id, cadence);
      CREATE INDEX IF NOT EXISTS idx_todos_user_completed ON todos(user_id, is_completed);
      CREATE INDEX IF NOT EXISTS idx_todos_user_updated ON todos(user_id, updated_at DESC);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS todos;
    `);
  },
};
