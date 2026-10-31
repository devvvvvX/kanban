import type { ISqlDatabase } from "../types";
import type { Migration } from "./0001_initial_auth";

export const migration0007: Migration = {
  version: 7,
  name: "workspaces_support",
  up: (db: ISqlDatabase) => {
    // 1. Workspaces table
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        icon TEXT NOT NULL DEFAULT 'briefcase',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
    `);

    // 2. Add workspace_id column to projects if it does not already exist
    const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    const hasWorkspaceId = projectColumns.some((c) => c.name === "workspace_id");
    if (!hasWorkspaceId) {
      db.exec(`
        ALTER TABLE projects ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
      `);
    }

    // 3. Populate default workspaces for all existing users and assign their projects
    const users = db.prepare("SELECT id, display_name FROM users").all() as Array<{ id: string; display_name: string }>;
    const now = new Date().toISOString();
    for (const u of users) {
      const workspaceId = `ws_${u.id}_default`;
      const existing = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(workspaceId);
      if (!existing) {
        db.prepare(`
          INSERT INTO workspaces (id, user_id, name, description, color, icon, is_default, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
          workspaceId,
          u.id,
          `${u.display_name || "Personal"}'s Workspace`,
          "Default primary workspace",
          "#3B82F6",
          "briefcase",
          now,
          now
        );

        db.prepare(`
          UPDATE projects SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')
        `).run(workspaceId, u.id);
      }
    }
  },
  down: (db: ISqlDatabase) => {
    db.exec(`DROP TABLE IF EXISTS workspaces;`);
  },
};
