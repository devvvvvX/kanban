import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0005: Migration = {
  version: 5,
  name: "saved_queries_and_search_indexes",
  up: (db: ISqlDatabase) => {
    // 1. Saved queries table
    db.exec(`
      CREATE TABLE IF NOT EXISTS saved_queries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'filter',
        color TEXT NOT NULL DEFAULT '#3B82F6',
        filter_json TEXT NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
        sort_json TEXT NOT NULL DEFAULT '{"field":"created_at","direction":"DESC"}',
        position REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_saved_queries_user ON saved_queries(user_id);
      CREATE INDEX IF NOT EXISTS idx_saved_queries_proj ON saved_queries(project_id);
    `);

    // 2. High-performance search and query indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickets_title ON tickets(user_id, title);
      CREATE INDEX IF NOT EXISTS idx_tickets_priority_due ON tickets(user_id, priority, due_date);
      CREATE INDEX IF NOT EXISTS idx_epics_title ON epics(user_id, title);
      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(user_id, name);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_projects_name;
      DROP INDEX IF EXISTS idx_epics_title;
      DROP INDEX IF EXISTS idx_tickets_priority_due;
      DROP INDEX IF EXISTS idx_tickets_title;
      DROP TABLE IF EXISTS saved_queries;
    `);
  },
};
