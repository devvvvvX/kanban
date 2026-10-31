import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface ProjectRecord {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_pinned: number; // 0 or 1
  is_archived: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  userId: string;
  workspaceId?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isPinned?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  isPinned?: boolean;
  workspaceId?: string;
}

export class ProjectService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Creates a new project for a user.
   */
  createProject(input: CreateProjectInput): ProjectRecord {
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
      throw new Error("Project name must be between 1 and 100 characters");
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const color = input.color || "#3B82F6";
    const icon = input.icon || "folder";
    const isPinned = input.isPinned ? 1 : 0;
    const description = input.description?.trim() || null;
    const workspaceId = input.workspaceId || null;

    this.db.prepare(`
      INSERT INTO projects (id, user_id, workspace_id, name, description, color, icon, is_pinned, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(projectId, input.userId, workspaceId, trimmedName, description, color, icon, isPinned, now, now);

    const created = this.getProject(projectId, input.userId);
    if (!created) throw new Error("Failed to retrieve created project");
    return created;
  }

  /**
   * Retrieves a single project, asserting user account ownership.
   */
  getProject(projectId: string, userId: string): ProjectRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id, workspace_id, name, description, color, icon, is_pinned, is_archived, created_at, updated_at
      FROM projects
      WHERE id = ? AND user_id = ?
    `).get(projectId, userId);

    return (row as ProjectRecord) ?? null;
  }

  /**
   * Lists projects for a user. By default returns active projects, sorted with pinned projects first.
   */
  listProjects(userId: string, options?: { includeArchived?: boolean; onlyPinned?: boolean; workspaceId?: string }): ProjectRecord[] {
    let query = "SELECT * FROM projects WHERE user_id = ?";
    const params: any[] = [userId];

    if (options?.workspaceId) {
      query += " AND (workspace_id = ? OR workspace_id IS NULL)";
      params.push(options.workspaceId);
    }

    if (!options?.includeArchived) {
      query += " AND is_archived = 0";
    }

    if (options?.onlyPinned) {
      query += " AND is_pinned = 1";
    }

    query += " ORDER BY is_pinned DESC, updated_at DESC";

    const rows = this.db.prepare(query).all(...params);
    return rows as ProjectRecord[];
  }

  /**
   * Updates an existing project.
   */
  updateProject(projectId: string, userId: string, updates: UpdateProjectInput): ProjectRecord {
    const existing = this.getProject(projectId, userId);
    if (!existing) {
      throw new Error("Project not found or access denied");
    }

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    if (name.length < 1 || name.length > 100) {
      throw new Error("Project name must be between 1 and 100 characters");
    }

    const description = updates.description !== undefined ? updates.description : existing.description;
    const color = updates.color !== undefined ? updates.color : existing.color;
    const icon = updates.icon !== undefined ? updates.icon : existing.icon;
    const isPinned = updates.isPinned !== undefined ? (updates.isPinned ? 1 : 0) : existing.is_pinned;
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, color = ?, icon = ?, is_pinned = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(name, description, color, icon, isPinned, now, projectId, userId);

    const updated = this.getProject(projectId, userId);
    if (!updated) throw new Error("Failed to retrieve updated project");
    return updated;
  }

  /**
   * Toggles the pinned status of a project.
   */
  togglePin(projectId: string, userId: string): ProjectRecord {
    const existing = this.getProject(projectId, userId);
    if (!existing) throw new Error("Project not found");
    const nextPinned = existing.is_pinned === 1 ? 0 : 1;
    return this.updateProject(projectId, userId, { isPinned: nextPinned === 1 });
  }

  /**
   * Archives a project.
   */
  archiveProject(projectId: string, userId: string): void {
    const existing = this.getProject(projectId, userId);
    if (!existing) throw new Error("Project not found");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE projects SET is_archived = 1, updated_at = ? WHERE id = ? AND user_id = ?").run(now, projectId, userId);
  }

  /**
   * Restores an archived project.
   */
  restoreProject(projectId: string, userId: string): void {
    const existing = this.getProject(projectId, userId);
    if (!existing) throw new Error("Project not found");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE projects SET is_archived = 0, updated_at = ? WHERE id = ? AND user_id = ?").run(now, projectId, userId);
  }

  /**
   * Deletes a project (cascades to epics, tickets, and subtasks).
   */
  deleteProject(projectId: string, userId: string): void {
    const existing = this.getProject(projectId, userId);
    if (!existing) throw new Error("Project not found");
    this.db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(projectId, userId);
  }
}
