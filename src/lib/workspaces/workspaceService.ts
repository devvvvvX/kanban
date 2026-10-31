import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface WorkspaceRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_default: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceInput {
  userId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
}

export class WorkspaceService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Ensures a default workspace exists for the given user.
   */
  ensureDefaultWorkspace(userId: string, displayName?: string): WorkspaceRecord {
    const existing = this.db.prepare(`
      SELECT * FROM workspaces WHERE user_id = ? AND is_default = 1
    `).get(userId) as WorkspaceRecord | undefined;

    if (existing) {
      return existing;
    }

    // Check if any workspace exists for user
    const anyWorkspace = this.db.prepare(`
      SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
    `).get(userId) as WorkspaceRecord | undefined;

    if (anyWorkspace) {
      this.db.prepare(`UPDATE workspaces SET is_default = 1 WHERE id = ?`).run(anyWorkspace.id);
      return { ...anyWorkspace, is_default: 1 };
    }

    const workspaceId = `ws_${userId}_default`;
    const now = new Date().toISOString();
    const name = `${displayName || "Personal"}'s Workspace`;

    this.db.prepare(`
      INSERT INTO workspaces (id, user_id, name, description, color, icon, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      workspaceId,
      userId,
      name,
      "Default primary workspace",
      "#3B82F6",
      "briefcase",
      now,
      now
    );

    // Reassign orphan projects
    this.db.prepare(`
      UPDATE projects SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')
    `).run(workspaceId, userId);

    return this.getWorkspace(workspaceId, userId)!;
  }

  /**
   * Creates a new workspace.
   */
  createWorkspace(input: CreateWorkspaceInput): WorkspaceRecord {
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
      throw new Error("Workspace name must be between 1 and 100 characters");
    }

    const workspaceId = crypto.randomUUID();
    const now = new Date().toISOString();
    const color = input.color || "#3B82F6";
    const icon = input.icon || "briefcase";
    const isDefault = input.isDefault ? 1 : 0;
    const description = input.description?.trim() || null;

    if (isDefault) {
      this.db.prepare(`UPDATE workspaces SET is_default = 0 WHERE user_id = ?`).run(input.userId);
    }

    this.db.prepare(`
      INSERT INTO workspaces (id, user_id, name, description, color, icon, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspaceId,
      input.userId,
      trimmedName,
      description,
      color,
      icon,
      isDefault,
      now,
      now
    );

    const created = this.getWorkspace(workspaceId, input.userId);
    if (!created) throw new Error("Failed to retrieve created workspace");
    return created;
  }

  /**
   * Retrieves a single workspace by ID.
   */
  getWorkspace(workspaceId: string, userId: string): WorkspaceRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM workspaces WHERE id = ? AND user_id = ?
    `).get(workspaceId, userId);
    return (row as WorkspaceRecord) ?? null;
  }

  /**
   * Lists all workspaces for a user, sorted with default first, then by name.
   */
  listWorkspaces(userId: string): WorkspaceRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM workspaces
      WHERE user_id = ?
      ORDER BY is_default DESC, name ASC
    `).all(userId);
    return rows as WorkspaceRecord[];
  }

  /**
   * Updates an existing workspace.
   */
  updateWorkspace(workspaceId: string, userId: string, updates: UpdateWorkspaceInput): WorkspaceRecord {
    const existing = this.getWorkspace(workspaceId, userId);
    if (!existing) {
      throw new Error("Workspace not found or access denied");
    }

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    if (name.length < 1 || name.length > 100) {
      throw new Error("Workspace name must be between 1 and 100 characters");
    }

    const description = updates.description !== undefined ? (updates.description ? updates.description.trim() : null) : existing.description;
    const color = updates.color || existing.color;
    const icon = updates.icon || existing.icon;
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE workspaces
      SET name = ?, description = ?, color = ?, icon = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(name, description, color, icon, now, workspaceId, userId);

    return this.getWorkspace(workspaceId, userId)!;
  }

  /**
   * Deletes a workspace. Cannot delete if it is the only workspace or the default workspace.
   * Reassigns projects in this workspace to default workspace.
   */
  deleteWorkspace(workspaceId: string, userId: string): void {
    const workspaces = this.listWorkspaces(userId);
    if (workspaces.length <= 1) {
      throw new Error("Cannot delete your only workspace");
    }

    const target = workspaces.find((w) => w.id === workspaceId);
    if (!target) {
      throw new Error("Workspace not found");
    }

    const defaultWs = workspaces.find((w) => w.is_default === 1 && w.id !== workspaceId) || workspaces.find((w) => w.id !== workspaceId);
    if (!defaultWs) {
      throw new Error("No fallback workspace available");
    }

    // Reassign projects to fallback workspace
    this.db.prepare(`
      UPDATE projects SET workspace_id = ? WHERE workspace_id = ? AND user_id = ?
    `).run(defaultWs.id, workspaceId, userId);

    // If deleting default, make fallback default
    if (target.is_default === 1) {
      this.db.prepare(`UPDATE workspaces SET is_default = 1 WHERE id = ?`).run(defaultWs.id);
    }

    this.db.prepare(`DELETE FROM workspaces WHERE id = ? AND user_id = ?`).run(workspaceId, userId);
  }
}
