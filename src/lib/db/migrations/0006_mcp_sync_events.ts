import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0006: Migration = {
  version: 6,
  name: "mcp_sync_events",
  up: (db: ISqlDatabase) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_events_user_time ON sync_events(user_id, created_at);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_sync_events_user_time;
      DROP TABLE IF EXISTS sync_events;
    `);
  },
};
