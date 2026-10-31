import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export interface BackupStats {
  projects: number;
  workflowStates: number;
  epics: number;
  tickets: number;
  subtasks: number;
  dependencies: number;
  comments: number;
  activities: number;
  savedQueries: number;
}

export interface BackupData {
  projects: any[];
  workflowStates: any[];
  epics: any[];
  tickets: any[];
  subtasks: any[];
  dependencies: any[];
  comments: any[];
  activities: any[];
  savedQueries: any[];
}

export interface BackupPayload {
  version: "1.0";
  appName: "macos-kanban";
  exportedAt: string;
  checksum: string;
  data: BackupData;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  stats?: BackupStats;
  payload?: BackupPayload;
}

export interface RestoreResult {
  success: boolean;
  mode: "merge" | "replace";
  stats: BackupStats;
}

export async function calculateChecksum(dataJson: string): Promise<string> {
  const buffer = new TextEncoder().encode(dataJson);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class BackupService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Exports full relational workspace data for an authenticated user with checksum integrity.
   */
  async exportWorkspace(userId: string): Promise<BackupPayload> {
    if (!userId) {
      throw new Error("Cannot export: missing userId");
    }

    // Query all entities belonging strictly to this user
    const projects = this.db.prepare("SELECT * FROM projects WHERE user_id = ?").all(userId);
    const workflowStates = this.db.prepare("SELECT * FROM workflow_states WHERE user_id = ?").all(userId);
    const epics = this.db.prepare("SELECT * FROM epics WHERE user_id = ?").all(userId);
    const tickets = this.db.prepare("SELECT * FROM tickets WHERE user_id = ?").all(userId);
    const subtasks = this.db.prepare("SELECT * FROM subtasks WHERE user_id = ?").all(userId);
    const dependencies = this.db.prepare("SELECT * FROM ticket_dependencies WHERE user_id = ?").all(userId);
    const comments = this.db.prepare("SELECT * FROM ticket_comments WHERE user_id = ?").all(userId);
    const activities = this.db.prepare("SELECT * FROM ticket_activity WHERE user_id = ?").all(userId);
    const savedQueries = this.db.prepare("SELECT * FROM saved_queries WHERE user_id = ?").all(userId);

    const data: BackupData = {
      projects,
      workflowStates,
      epics,
      tickets,
      subtasks,
      dependencies,
      comments,
      activities,
      savedQueries,
    };

    const dataJson = JSON.stringify(data);
    const checksum = await calculateChecksum(dataJson);

    return {
      version: "1.0",
      appName: "macos-kanban",
      exportedAt: new Date().toISOString(),
      checksum,
      data,
    };
  }

  /**
   * Validates a backup JSON string: verifies version, schema structure, and cryptographic checksum.
   */
  async validateBackup(jsonString: string): Promise<ValidationResult> {
    try {
      const parsed = JSON.parse(jsonString) as BackupPayload;

      if (!parsed || typeof parsed !== "object") {
        return { valid: false, error: "Invalid backup file: not a JSON object" };
      }

      if (parsed.appName !== "macos-kanban") {
        return { valid: false, error: `Incompatible application: ${parsed.appName || "unknown"}` };
      }

      if (parsed.version !== "1.0") {
        return { valid: false, error: `Unsupported backup version: ${parsed.version}` };
      }

      if (!parsed.data || typeof parsed.data !== "object") {
        return { valid: false, error: "Corrupted backup: missing 'data' payload" };
      }

      const { data } = parsed;
      const requiredArrays = [
        "projects",
        "workflowStates",
        "epics",
        "tickets",
        "subtasks",
        "dependencies",
        "comments",
        "activities",
        "savedQueries",
      ];

      for (const field of requiredArrays) {
        if (!Array.isArray((data as any)[field])) {
          return { valid: false, error: `Corrupted backup: missing or invalid '${field}' list` };
        }
      }

      // Verify SHA-256 checksum
      const computedChecksum = await calculateChecksum(JSON.stringify(data));
      if (computedChecksum !== parsed.checksum) {
        return {
          valid: false,
          error: "Integrity check failed: checksum mismatch (file may be modified or corrupted)",
        };
      }

      const stats: BackupStats = {
        projects: data.projects.length,
        workflowStates: data.workflowStates.length,
        epics: data.epics.length,
        tickets: data.tickets.length,
        subtasks: data.subtasks.length,
        dependencies: data.dependencies.length,
        comments: data.comments.length,
        activities: data.activities.length,
        savedQueries: data.savedQueries.length,
      };

      return {
        valid: true,
        stats,
        payload: parsed,
      };
    } catch (err: any) {
      return { valid: false, error: `JSON parse error: ${err.message || String(err)}` };
    }
  }

  /**
   * Restores workspace data from a validated BackupPayload within an atomic transaction.
   * Forces all records to the destination userId for security and account isolation.
   */
  async restoreWorkspace(
    userId: string,
    payload: BackupPayload,
    mode: "merge" | "replace" = "merge"
  ): Promise<RestoreResult> {
    if (!userId) {
      throw new Error("Cannot restore: missing userId");
    }

    const { data } = payload;

    // Run restore atomically inside transaction
    const txn = this.db.transaction(() => {
      if (mode === "replace") {
        // Purge existing data in reverse dependency order
        this.db.prepare("DELETE FROM saved_queries WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM ticket_activity WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM ticket_comments WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM ticket_dependencies WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM subtasks WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM tickets WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM workflow_states WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM epics WHERE user_id = ?").run(userId);
        this.db.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
      }

      // 1. Projects
      const insertProj = this.db.prepare(`
        INSERT OR REPLACE INTO projects (id, user_id, name, description, color, icon, is_pinned, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.projects) {
        insertProj.run(
          p.id,
          userId, // enforce target userId
          p.name,
          p.description,
          p.color,
          p.icon,
          p.is_pinned ?? 0,
          p.is_archived ?? 0,
          p.created_at,
          p.updated_at
        );
      }

      // 2. Workflow States
      const insertState = this.db.prepare(`
        INSERT OR REPLACE INTO workflow_states (id, user_id, project_id, name, category, color, position, wip_limit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.workflowStates) {
        insertState.run(
          s.id,
          userId,
          s.project_id,
          s.name,
          s.category,
          s.color,
          s.position,
          s.wip_limit,
          s.created_at,
          s.updated_at
        );
      }

      // 3. Epics
      const insertEpic = this.db.prepare(`
        INSERT OR REPLACE INTO epics (id, user_id, project_id, name, description, color, status, start_date, target_date, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of data.epics) {
        insertEpic.run(
          e.id,
          userId,
          e.project_id,
          e.name,
          e.description,
          e.color,
          e.status,
          e.start_date,
          e.target_date,
          e.is_archived ?? 0,
          e.created_at,
          e.updated_at
        );
      }

      // 4. Tickets
      const insertTicket = this.db.prepare(`
        INSERT OR REPLACE INTO tickets (id, user_id, project_id, epic_id, workflow_state_id, parent_id, ticket_number, identifier, title, description, priority, labels, due_date, estimate, position, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of data.tickets) {
        insertTicket.run(
          t.id,
          userId,
          t.project_id,
          t.epic_id,
          t.workflow_state_id,
          t.parent_id,
          t.ticket_number,
          t.identifier,
          t.title,
          t.description,
          t.priority,
          typeof t.labels === "string" ? t.labels : JSON.stringify(t.labels || []),
          t.due_date,
          t.estimate,
          t.position,
          t.is_archived ?? 0,
          t.created_at,
          t.updated_at
        );
      }

      // 5. Subtasks
      const insertSubtask = this.db.prepare(`
        INSERT OR REPLACE INTO subtasks (id, user_id, ticket_id, title, is_completed, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const st of data.subtasks) {
        insertSubtask.run(
          st.id,
          userId,
          st.ticket_id,
          st.title,
          st.is_completed ?? 0,
          st.position ?? 0,
          st.created_at,
          st.updated_at
        );
      }

      // 6. Dependencies
      const insertDep = this.db.prepare(`
        INSERT OR REPLACE INTO ticket_dependencies (id, user_id, source_ticket_id, target_ticket_id, relationship_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const dep of data.dependencies) {
        insertDep.run(
          dep.id,
          userId,
          dep.source_ticket_id,
          dep.target_ticket_id,
          dep.relationship_type,
          dep.created_at
        );
      }

      // 7. Comments
      const insertComment = this.db.prepare(`
        INSERT OR REPLACE INTO ticket_comments (id, user_id, ticket_id, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.comments) {
        insertComment.run(c.id, userId, c.ticket_id, c.content, c.created_at, c.updated_at);
      }

      // 8. Activities
      const insertActivity = this.db.prepare(`
        INSERT OR REPLACE INTO ticket_activity (id, user_id, ticket_id, actor_name, action_type, field_changed, old_value, new_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of data.activities) {
        insertActivity.run(
          a.id,
          userId,
          a.ticket_id,
          a.actor_name,
          a.action_type,
          a.field_changed,
          a.old_value,
          a.new_value,
          a.created_at
        );
      }

      // 9. Saved Queries
      const insertQuery = this.db.prepare(`
        INSERT OR REPLACE INTO saved_queries (id, user_id, project_id, name, icon, color, filter_json, sort_json, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const q of data.savedQueries) {
        insertQuery.run(
          q.id,
          userId,
          q.project_id,
          q.name,
          q.icon ?? "filter",
          q.color ?? "#3B82F6",
          typeof q.filter_json === "string" ? q.filter_json : JSON.stringify(q.filter_json || {}),
          typeof q.sort_json === "string" ? q.sort_json : JSON.stringify(q.sort_json || {}),
          q.position ?? 0,
          q.created_at,
          q.updated_at
        );
      }
    });

    txn();

    return {
      success: true,
      mode,
      stats: {
        projects: data.projects.length,
        workflowStates: data.workflowStates.length,
        epics: data.epics.length,
        tickets: data.tickets.length,
        subtasks: data.subtasks.length,
        dependencies: data.dependencies.length,
        comments: data.comments.length,
        activities: data.activities.length,
        savedQueries: data.savedQueries.length,
      },
    };
  }
}
