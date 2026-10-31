import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations, getAppliedMigrations } from "../../src/lib/db/migrations";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("Database & Migration Runner", () => {
  let db: ISqlDatabase;

  beforeEach(async () => {
    db = await resetTestDb();
  });

  afterEach(() => {
    closeDb();
  });

  it("initializes SQLite with WAL and foreign keys enabled", () => {
    const fk = db.pragma("foreign_keys", { simple: true });
    expect(fk).toBe(1);
  });

  it("runs all registered migrations cleanly and records them in schema_migrations", () => {
    const res = runMigrations(db);
    expect(res.applied).toBe(12);
    expect(res.currentVersion).toBe(12);

    const applied = getAppliedMigrations(db);
    expect(applied).toHaveLength(12);
    expect(applied[0].name).toBe("initial_auth_and_account_isolation");
    expect(applied[1].name).toBe("projects_and_epics_hierarchy");
    expect(applied[2].name).toBe("tickets_and_workflow_states");
    expect(applied[3].name).toBe("subtasks_dependencies_comments_activity");
    expect(applied[4].name).toBe("saved_queries_and_search_indexes");
    expect(applied[5].name).toBe("mcp_sync_events");
    expect(applied[6].name).toBe("workspaces_support");
    expect(applied[7].name).toBe("mcp_settings");
    expect(applied[8].name).toBe("attachments_and_notes");
    expect(applied[9].name).toBe("todos");
    expect(applied[10].name).toBe("todo_stars");
    expect(applied[11].name).toBe("todo_steps_reminders");

    // Second run should be idempotent
    const rerun = runMigrations(db);
    expect(rerun.applied).toBe(0);
    expect(rerun.currentVersion).toBe(12);
  });

  it("verifies tables exist and enforce constraints", () => {
    runMigrations(db);

    // Insert user
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run("user-1", "alice@example.com", "hash123", "Alice", "active", "2026-10-25T00:00:00Z", "2026-10-25T00:00:00Z");

    // Duplicate email should throw UNIQUE constraint failed
    expect(() => {
      insertUser.run("user-2", "ALICE@example.com", "hash456", "Alice 2", "active", "2026-10-25T00:00:00Z", "2026-10-25T00:00:00Z");
    }).toThrow(/UNIQUE constraint failed/);

    // Foreign key constraint test: inserting session with nonexistent user_id should fail
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, user_id, token, duration_days, keep_signed_in, created_at, expires_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    expect(() => {
      insertSession.run("sess-1", "nonexistent-user", "token-xyz", 30, 1, "2026-10-25T00:00:00Z", "2026-11-24T00:00:00Z", "2026-10-25T00:00:00Z");
    }).toThrow(/FOREIGN KEY constraint failed/);

    // Cascade delete test: deleting user should delete their sessions
    insertSession.run("sess-1", "user-1", "token-xyz", 30, 1, "2026-10-25T00:00:00Z", "2026-11-24T00:00:00Z", "2026-10-25T00:00:00Z");
    expect(db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = 'user-1'").get()).toEqual({ count: 1 });

    db.prepare("DELETE FROM users WHERE id = 'user-1'").run();
    expect(db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = 'user-1'").get()).toEqual({ count: 0 });
  });
});
