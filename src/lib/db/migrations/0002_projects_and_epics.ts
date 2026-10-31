import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0002: Migration = {
  version: 2,
  name: "projects_and_epics_hierarchy",
  up: (db: ISqlDatabase) => {
    // 1. Projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        icon TEXT NOT NULL DEFAULT 'folder',
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(user_id, is_pinned);
      CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(user_id, is_archived);
    `);

    // 2. Epics table
    db.exec(`
      CREATE TABLE IF NOT EXISTS epics (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#8B5CF6',
        icon TEXT NOT NULL DEFAULT 'target',
        status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled')),
        start_date TEXT,
        target_date TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_epics_user_id ON epics(user_id);
      CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id);
      CREATE INDEX IF NOT EXISTS idx_epics_status ON epics(project_id, status);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS epics;
      DROP TABLE IF EXISTS projects;
    `);
  },
};
