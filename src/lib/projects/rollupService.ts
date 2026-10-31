import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface ProjectMetrics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  completedTickets: number;
  totalEpics: number;
  completionRate: number; // 0 to 100
}

export interface EpicRollup {
  epicId: string;
  totalTickets: number;
  completedTickets: number;
  progressPercentage: number; // 0 to 100
}

export class RollupService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Helper to check if a table exists in SQLite
   */
  private tableExists(tableName: string): boolean {
    const row = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    ).get(tableName);
    return !!row;
  }

  /**
   * Computes high-level metrics for a project:
   * - Total epics count
   * - Total tickets, open, in-progress, and completed counts (excluding subtasks)
   * - Overall completion rate percentage
   */
  getProjectMetrics(projectId: string, userId: string): ProjectMetrics {
    // 1. Verify project access
    const project = this.db.prepare(
      "SELECT id FROM projects WHERE id = ? AND user_id = ?"
    ).get(projectId, userId);

    if (!project) {
      throw new Error("Project not found or access denied");
    }

    // 2. Count epics
    const epicsRow = this.db.prepare(
      "SELECT COUNT(*) as count FROM epics WHERE project_id = ? AND user_id = ? AND is_archived = 0"
    ).get(projectId, userId) as { count: number };
    const totalEpics = epicsRow?.count || 0;

    // 3. Count tickets if tickets table exists
    if (!this.tableExists("tickets")) {
      return {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        completedTickets: 0,
        totalEpics,
        completionRate: 0,
      };
    }

    // Exclude subtasks (where parent_id IS NOT NULL) to avoid double-counting
    // Join with workflow_states to determine semantic category
    let ticketRows: Array<{ category: string; count: number }> = [];

    if (this.tableExists("workflow_states")) {
      ticketRows = this.db.prepare(`
        SELECT COALESCE(ws.category, 'unstarted') as category, COUNT(*) as count
        FROM tickets t
        LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
        WHERE t.project_id = ? AND t.user_id = ? AND (t.parent_id IS NULL OR t.parent_id = '')
        GROUP BY ws.category
      `).all(projectId, userId) as Array<{ category: string; count: number }>;
    }

    let openTickets = 0;
    let inProgressTickets = 0;
    let completedTickets = 0;
    let totalTickets = 0;

    for (const r of ticketRows) {
      const count = Number(r.count) || 0;
      totalTickets += count;
      const cat = (r.category || "").toLowerCase();
      if (cat === "completed" || cat === "done") {
        completedTickets += count;
      } else if (cat === "started" || cat === "in_progress") {
        inProgressTickets += count;
      } else {
        openTickets += count;
      }
    }

    const completionRate = totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      completedTickets,
      totalEpics,
      completionRate,
    };
  }

  /**
   * Computes rollup for a specific epic:
   * - Total top-level tickets assigned to this epic
   * - Completed tickets
   * - Progress percentage (completed / total * 100), ensuring subtasks are NOT double-counted
   */
  getEpicRollup(epicId: string, userId: string): EpicRollup {
    // 1. Verify epic access
    const epic = this.db.prepare(
      "SELECT id FROM epics WHERE id = ? AND user_id = ?"
    ).get(epicId, userId);

    if (!epic) {
      throw new Error("Epic not found or access denied");
    }

    if (!this.tableExists("tickets")) {
      return {
        epicId,
        totalTickets: 0,
        completedTickets: 0,
        progressPercentage: 0,
      };
    }

    let rows: Array<{ category: string; count: number }> = [];
    if (this.tableExists("workflow_states")) {
      rows = this.db.prepare(`
        SELECT COALESCE(ws.category, 'unstarted') as category, COUNT(*) as count
        FROM tickets t
        LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
        WHERE t.epic_id = ? AND t.user_id = ? AND (t.parent_id IS NULL OR t.parent_id = '')
        GROUP BY ws.category
      `).all(epicId, userId) as Array<{ category: string; count: number }>;
    }

    let totalTickets = 0;
    let completedTickets = 0;

    for (const r of rows) {
      const count = Number(r.count) || 0;
      totalTickets += count;
      const cat = (r.category || "").toLowerCase();
      if (cat === "completed" || cat === "done") {
        completedTickets += count;
      }
    }

    const progressPercentage =
      totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

    return {
      epicId,
      totalTickets,
      completedTickets,
      progressPercentage,
    };
  }
}
