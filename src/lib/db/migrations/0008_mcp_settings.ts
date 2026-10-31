import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0008: Migration = {
  version: 8,
  name: "mcp_settings",
  up: (db: ISqlDatabase) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS mcp_settings;
    `);
  },
};
