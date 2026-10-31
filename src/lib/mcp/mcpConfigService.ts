import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";

export class McpConfigService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Check if MCP agent tool access is enabled for the specified user.
   * Defaults to true if no explicit record exists.
   */
  isMcpEnabled(userId: string): boolean {
    if (!userId) return false;

    try {
      // First check localStorage for immediate cache in browser environment
      if (typeof window !== "undefined" && window.localStorage) {
        const cached = window.localStorage.getItem(`kanban_mcp_enabled_${userId}`);
        if (cached !== null) {
          return cached === "true";
        }
      }

      // Query database
      const row = this.db
        .prepare("SELECT is_enabled FROM mcp_settings WHERE user_id = ?")
        .get(userId) as { is_enabled: number } | undefined;

      if (!row) {
        return true; // default enabled
      }

      const enabled = row.is_enabled === 1;

      // Update localStorage cache if in browser
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(`kanban_mcp_enabled_${userId}`, String(enabled));
      }

      return enabled;
    } catch {
      // Fall back to default true if table not yet migrated or query fails
      return true;
    }
  }

  /**
   * Updates MCP enabled status for the user in database, localStorage, and broadcasts event.
   */
  setMcpEnabled(userId: string, enabled: boolean): void {
    if (!userId) return;

    const now = new Date().toISOString();
    const isEnabledNum = enabled ? 1 : 0;

    // Upsert into database
    try {
      this.db
        .prepare(
          `INSERT INTO mcp_settings (user_id, is_enabled, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             is_enabled = excluded.is_enabled,
             updated_at = excluded.updated_at`
        )
        .run(userId, isEnabledNum, now);
    } catch (err) {
      console.error("[McpConfigService] Failed to persist MCP setting to DB:", err);
    }

    // Persist to localStorage for client-side reactivity
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(`kanban_mcp_enabled_${userId}`, String(enabled));
      } catch {
        // ignore storage errors
      }

      // Dispatch global window event for live UI reactivity
      try {
        window.dispatchEvent(
          new CustomEvent("kanban-mcp-status-change", {
            detail: { userId, enabled },
          })
        );
      } catch {
        // ignore event errors
      }
    }
  }
}
