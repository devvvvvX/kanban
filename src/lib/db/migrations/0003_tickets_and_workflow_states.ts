import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0003: Migration = {
  version: 3,
  name: "tickets_and_workflow_states",
  up: (db: ISqlDatabase) => {
    // 1. Workflow states table
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_states (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'unstarted' CHECK(category IN ('backlog', 'unstarted', 'started', 'completed', 'cancelled')),
        color TEXT NOT NULL DEFAULT '#3B82F6',
        position REAL NOT NULL DEFAULT 0,
        wip_limit INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_states_user ON workflow_states(user_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_states_proj_pos ON workflow_states(project_id, position);
    `);

    // 2. Tickets table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        epic_id TEXT REFERENCES epics(id) ON DELETE SET NULL,
        workflow_state_id TEXT NOT NULL REFERENCES workflow_states(id) ON DELETE RESTRICT,
        parent_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
        ticket_number INTEGER NOT NULL,
        identifier TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'none' CHECK(priority IN ('none', 'low', 'medium', 'high', 'urgent')),
        labels TEXT NOT NULL DEFAULT '[]',
        due_date TEXT,
        estimate INTEGER,
        position REAL NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_project_state ON tickets(project_id, workflow_state_id, position);
      CREATE INDEX IF NOT EXISTS idx_tickets_epic_id ON tickets(epic_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_identifier ON tickets(project_id, identifier);
      CREATE INDEX IF NOT EXISTS idx_tickets_parent_id ON tickets(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_archived ON tickets(user_id, is_archived);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS tickets;
      DROP TABLE IF EXISTS workflow_states;
    `);
  },
};
