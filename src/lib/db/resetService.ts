import type { ISqlDatabase } from "./types";
import { getDb, flushDbSave, clearDbFromIndexedDb } from "./connection";
import { WorkspaceService } from "../workspaces/workspaceService";
import { ProjectService } from "../projects/projectService";
import { WorkflowStateService } from "../tickets/workflowStateService";
import { isTauri, invoke } from "@tauri-apps/api/core";

export interface ResetWorkspaceResult {
  success: boolean;
  preservedUsersCount: number;
  message: string;
}

export class DatabaseResetService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Resets all operational workspace data while strictly preserving:
   * - users
   * - recovery_verifiers
   * - sessions
   * - login_attempts
   * - schema_migrations
   *
   * Re-seeds a default Workspace, Project, and Workflow States for each preserved user.
   */
  async resetWorkspaceData(): Promise<ResetWorkspaceResult> {
    const db = this.db;

    // Retrieve all existing accounts to preserve
    const users = db.prepare("SELECT id, display_name, email FROM users").all() as Array<{
      id: string;
      display_name: string;
      email: string;
    }>;

    // 1. Delete operational tables in an atomic transaction
    const deleteTxn = db.transaction(() => {
      const tablesToClean = [
        "ticket_dependencies",
        "subtasks",
        "ticket_comments",
        "activity_events",
        "tickets",
        "workflow_states",
        "epics",
        "projects",
        "saved_queries",
        "mcp_sync_events",
        "mcp_settings",
        "workspace_members",
        "workspaces",
      ];

      for (const table of tablesToClean) {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
        } catch {
          // Table may not exist in partial test schemas
        }
      }
    });
    deleteTxn();

    // 2. Re-seed default workspace, project, and states for every preserved user
    const workspaceService = new WorkspaceService(db);
    const projectService = new ProjectService(db);
    const stateService = new WorkflowStateService(db);

    for (const user of users) {
      const workspace = workspaceService.ensureDefaultWorkspace(
        user.id,
        `${user.display_name || "Personal"}'s Workspace`
      );
      const project = projectService.createProject({
        userId: user.id,
        workspaceId: workspace.id,
        name: "Personal Projects",
        description: "Default workspace project",
        color: "#3B82F6",
        icon: "folder",
        isPinned: true,
      });
      stateService.ensureDefaultStates(project.id, user.id);
    }
    await flushDbSave();

    return {
      success: true,
      preservedUsersCount: users.length,
      message: `Cleaned workspace data. Preserved ${users.length} user account(s) and re-initialized default projects.`,
    };
  }

  /**
   * Performs a complete factory reset, wiping all data including user accounts.
   */
  async fullFactoryReset(options?: { deleteDiskFile?: boolean }): Promise<void> {
    const db = this.db;

    const allTables = [
      "ticket_dependencies",
      "subtasks",
      "ticket_comments",
      "activity_events",
      "tickets",
      "workflow_states",
      "epics",
      "projects",
      "saved_queries",
      "mcp_sync_events",
      "mcp_settings",
      "workspace_members",
      "workspaces",
      "login_attempts",
      "sessions",
      "recovery_verifiers",
      "users",
    ];

    const txn = db.transaction(() => {
      for (const table of allTables) {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
        } catch {
          // Ignore non-existent tables
        }
      }
    });

    txn();
    await flushDbSave();

    if (options?.deleteDiskFile) {
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("delete_database_from_disk");
        } catch (e) {
          console.warn("Delete database file on disk error:", e);
        }
      }
      await clearDbFromIndexedDb();
    }
  }
}
