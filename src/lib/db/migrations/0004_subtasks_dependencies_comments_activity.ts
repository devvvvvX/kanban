import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0004: Migration = {
  version: 4,
  name: "subtasks_dependencies_comments_activity",
  up: (db: ISqlDatabase) => {
    // 1. Subtasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        position REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subtasks_ticket_pos ON subtasks(ticket_id, position);
      CREATE INDEX IF NOT EXISTS idx_subtasks_user ON subtasks(user_id);
    `);

    // 2. Ticket dependencies table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_dependencies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        target_ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN ('relates_to', 'blocks', 'is_blocked_by', 'duplicates', 'is_duplicated_by')),
        created_at TEXT NOT NULL,
        UNIQUE(source_ticket_id, target_ticket_id, relationship_type)
      );
      CREATE INDEX IF NOT EXISTS idx_dependencies_source ON ticket_dependencies(source_ticket_id);
      CREATE INDEX IF NOT EXISTS idx_dependencies_target ON ticket_dependencies(target_ticket_id);
      CREATE INDEX IF NOT EXISTS idx_dependencies_user ON ticket_dependencies(user_id);
    `);

    // 3. Ticket comments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_comments_user ON ticket_comments(user_id);
    `);

    // 4. Ticket activity audit table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_activity (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_ticket ON ticket_activity(ticket_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_activity_user ON ticket_activity(user_id);
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS ticket_activity;
      DROP TABLE IF EXISTS ticket_comments;
      DROP TABLE IF EXISTS ticket_dependencies;
      DROP TABLE IF EXISTS subtasks;
    `);
  },
};
