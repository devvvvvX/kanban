import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import type { QueryFilterGroup, QuerySortOption } from "./queryEngine";

export interface SavedQueryRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  icon: string;
  color: string;
  filter: QueryFilterGroup;
  sort: QuerySortOption;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedQueryInput {
  userId: string;
  projectId?: string | null;
  name: string;
  icon?: string;
  color?: string;
  filter: QueryFilterGroup;
  sort?: QuerySortOption;
}

export interface UpdateSavedQueryInput {
  name?: string;
  icon?: string;
  color?: string;
  filter?: QueryFilterGroup;
  sort?: QuerySortOption;
  position?: number;
}

export class SavedQueryService {
  constructor(private dbInstance?: ISqlDatabase) {}

  private get db(): ISqlDatabase {
    return this.dbInstance ?? getDb();
  }

  public createSavedQuery(input: CreateSavedQueryInput): SavedQueryRecord {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Saved query name cannot be empty");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const icon = input.icon || "filter";
    const color = input.color || "#3B82F6";
    const filterJson = JSON.stringify(input.filter);
    const sortJson = JSON.stringify(
      input.sort || { field: "created_at", direction: "DESC" }
    );

    // Get max position
    const maxPosRow = this.db
      .prepare("SELECT MAX(position) as maxPos FROM saved_queries WHERE user_id = ?")
      .get(input.userId) as { maxPos: number | null };
    const position = (maxPosRow?.maxPos ?? 0) + 1000;

    this.db
      .prepare(
        `INSERT INTO saved_queries
         (id, user_id, project_id, name, icon, color, filter_json, sort_json, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.userId,
        input.projectId || null,
        trimmed,
        icon,
        color,
        filterJson,
        sortJson,
        position,
        now,
        now
      );

    return {
      id,
      user_id: input.userId,
      project_id: input.projectId || null,
      name: trimmed,
      icon,
      color,
      filter: input.filter,
      sort: input.sort || { field: "created_at", direction: "DESC" },
      position,
      created_at: now,
      updated_at: now,
    };
  }

  public updateSavedQuery(
    id: string,
    userId: string,
    updates: UpdateSavedQueryInput
  ): SavedQueryRecord {
    const existing = this.getSavedQuery(id, userId);
    if (!existing) {
      throw new Error("Saved query not found or unauthorized");
    }

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    if (!name) {
      throw new Error("Saved query name cannot be empty");
    }
    const icon = updates.icon !== undefined ? updates.icon : existing.icon;
    const color = updates.color !== undefined ? updates.color : existing.color;
    const filter = updates.filter !== undefined ? updates.filter : existing.filter;
    const sort = updates.sort !== undefined ? updates.sort : existing.sort;
    const position = updates.position !== undefined ? updates.position : existing.position;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE saved_queries
         SET name = ?, icon = ?, color = ?, filter_json = ?, sort_json = ?, position = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        name,
        icon,
        color,
        JSON.stringify(filter),
        JSON.stringify(sort),
        position,
        now,
        id,
        userId
      );

    return {
      id,
      user_id: userId,
      project_id: existing.project_id,
      name,
      icon,
      color,
      filter,
      sort,
      position,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  public deleteSavedQuery(id: string, userId: string): void {
    const res = this.db
      .prepare("DELETE FROM saved_queries WHERE id = ? AND user_id = ?")
      .run(id, userId);
    if (res.changes === 0) {
      throw new Error("Saved query not found or unauthorized");
    }
  }

  public getSavedQuery(id: string, userId: string): SavedQueryRecord | null {
    const row = this.db
      .prepare("SELECT * FROM saved_queries WHERE id = ? AND user_id = ?")
      .get(id, userId) as {
        id: string;
        user_id: string;
        project_id: string | null;
        name: string;
        icon: string;
        color: string;
        filter_json: string;
        sort_json: string;
        position: number;
        created_at: string;
        updated_at: string;
      } | undefined;

    if (!row) return null;

    let filter: QueryFilterGroup = { operator: "AND", conditions: [] };
    let sort: QuerySortOption = { field: "created_at", direction: "DESC" };

    try {
      filter = JSON.parse(row.filter_json);
    } catch {}
    try {
      sort = JSON.parse(row.sort_json);
    } catch {}

    return {
      id: row.id,
      user_id: row.user_id,
      project_id: row.project_id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      filter,
      sort,
      position: row.position,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public listSavedQueries(userId: string, projectId?: string): SavedQueryRecord[] {
    let sql = "SELECT * FROM saved_queries WHERE user_id = ?";
    const params: unknown[] = [userId];

    if (projectId) {
      sql += " AND (project_id = ? OR project_id IS NULL)";
      params.push(projectId);
    }

    sql += " ORDER BY position ASC, name ASC";

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      user_id: string;
      project_id: string | null;
      name: string;
      icon: string;
      color: string;
      filter_json: string;
      sort_json: string;
      position: number;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => {
      let filter: QueryFilterGroup = { operator: "AND", conditions: [] };
      let sort: QuerySortOption = { field: "created_at", direction: "DESC" };
      try {
        filter = JSON.parse(row.filter_json);
      } catch {}
      try {
        sort = JSON.parse(row.sort_json);
      } catch {}

      return {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        filter,
        sort,
        position: row.position,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
  }
}
