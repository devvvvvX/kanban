import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export type EpicStatus = "planned" | "in_progress" | "completed" | "cancelled";

export interface EpicRecord {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string;
  status: EpicStatus;
  start_date: string | null;
  target_date: string | null;
  is_archived: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface CreateEpicInput {
  userId: string;
  projectId: string;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: EpicStatus;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface UpdateEpicInput {
  title?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  status?: EpicStatus;
  startDate?: string | null;
  targetDate?: string | null;
}

export class EpicService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Validates date boundaries (start_date <= target_date if both are defined)
   */
  private validateDates(startDate?: string | null, targetDate?: string | null): void {
    if (startDate && targetDate) {
      const start = new Date(startDate).getTime();
      const target = new Date(targetDate).getTime();
      if (!isNaN(start) && !isNaN(target) && start > target) {
        throw new Error("Start date cannot be after target completion date");
      }
    }
  }

  /**
   * Creates a new epic within a project, verifying project ownership and active status.
   */
  createEpic(input: CreateEpicInput): EpicRecord {
    const trimmedTitle = input.title?.trim();
    if (!trimmedTitle || trimmedTitle.length < 1 || trimmedTitle.length > 150) {
      throw new Error("Epic title must be between 1 and 150 characters");
    }

    // Verify project belongs to user and exists
    const project = this.db.prepare(
      "SELECT id, is_archived FROM projects WHERE id = ? AND user_id = ?"
    ).get(input.projectId, input.userId) as { id: string; is_archived: number } | undefined;

    if (!project) {
      throw new Error("Project not found or access denied");
    }

    const validStatuses: EpicStatus[] = ["planned", "in_progress", "completed", "cancelled"];
    const status: EpicStatus = input.status || "planned";
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid epic status: ${status}`);
    }

    this.validateDates(input.startDate, input.targetDate);

    const epicId = crypto.randomUUID();
    const now = new Date().toISOString();
    const color = input.color || "#8B5CF6";
    const icon = input.icon || "target";
    const description = input.description?.trim() || null;
    const startDate = input.startDate || null;
    const targetDate = input.targetDate || null;

    this.db.prepare(`
      INSERT INTO epics (
        id, user_id, project_id, title, description, color, icon,
        status, start_date, target_date, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      epicId,
      input.userId,
      input.projectId,
      trimmedTitle,
      description,
      color,
      icon,
      status,
      startDate,
      targetDate,
      now,
      now
    );

    const created = this.getEpic(epicId, input.userId);
    if (!created) throw new Error("Failed to retrieve created epic");
    return created;
  }

  /**
   * Retrieves an epic by ID, asserting user ownership.
   */
  getEpic(epicId: string, userId: string): EpicRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id, project_id, title, description, color, icon,
             status, start_date, target_date, is_archived, created_at, updated_at
      FROM epics
      WHERE id = ? AND user_id = ?
    `).get(epicId, userId);

    return (row as EpicRecord) ?? null;
  }

  /**
   * Lists epics for a project with optional status filter.
   */
  listEpics(
    projectId: string,
    userId: string,
    options?: { status?: EpicStatus; includeArchived?: boolean }
  ): EpicRecord[] {
    let query = "SELECT * FROM epics WHERE project_id = ? AND user_id = ?";
    const params: any[] = [projectId, userId];

    if (!options?.includeArchived) {
      query += " AND is_archived = 0";
    }

    if (options?.status) {
      query += " AND status = ?";
      params.push(options.status);
    }

    query += " ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'planned' THEN 2 WHEN 'completed' THEN 3 WHEN 'cancelled' THEN 4 END, updated_at DESC";

    const rows = this.db.prepare(query).all(...params);
    return rows as EpicRecord[];
  }

  /**
   * Updates an existing epic.
   */
  updateEpic(epicId: string, userId: string, updates: UpdateEpicInput): EpicRecord {
    const existing = this.getEpic(epicId, userId);
    if (!existing) {
      throw new Error("Epic not found or access denied");
    }

    const title = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (title.length < 1 || title.length > 150) {
      throw new Error("Epic title must be between 1 and 150 characters");
    }

    const validStatuses: EpicStatus[] = ["planned", "in_progress", "completed", "cancelled"];
    const status = updates.status !== undefined ? updates.status : existing.status;
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid epic status: ${status}`);
    }

    const startDate = updates.startDate !== undefined ? updates.startDate : existing.start_date;
    const targetDate = updates.targetDate !== undefined ? updates.targetDate : existing.target_date;
    this.validateDates(startDate, targetDate);

    const description = updates.description !== undefined ? updates.description : existing.description;
    const color = updates.color !== undefined ? updates.color : existing.color;
    const icon = updates.icon !== undefined ? updates.icon : existing.icon;
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE epics
      SET title = ?, description = ?, color = ?, icon = ?, status = ?,
          start_date = ?, target_date = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title,
      description,
      color,
      icon,
      status,
      startDate,
      targetDate,
      now,
      epicId,
      userId
    );

    const updated = this.getEpic(epicId, userId);
    if (!updated) throw new Error("Failed to retrieve updated epic");
    return updated;
  }

  /**
   * Archives an epic.
   */
  archiveEpic(epicId: string, userId: string): void {
    const existing = this.getEpic(epicId, userId);
    if (!existing) throw new Error("Epic not found");
    const now = new Date().toISOString();
    this.db.prepare(
      "UPDATE epics SET is_archived = 1, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(now, epicId, userId);
  }

  /**
   * Restores an archived epic.
   */
  restoreEpic(epicId: string, userId: string): void {
    const existing = this.getEpic(epicId, userId);
    if (!existing) throw new Error("Epic not found");
    const now = new Date().toISOString();
    this.db.prepare(
      "UPDATE epics SET is_archived = 0, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(now, epicId, userId);
  }

  /**
   * Deletes an epic.
   */
  deleteEpic(epicId: string, userId: string): void {
    const existing = this.getEpic(epicId, userId);
    if (!existing) throw new Error("Epic not found");
    this.db.prepare("DELETE FROM epics WHERE id = ? AND user_id = ?").run(epicId, userId);
  }
}
