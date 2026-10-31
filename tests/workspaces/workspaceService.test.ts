import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { WorkspaceService } from "../../src/lib/workspaces/workspaceService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("WorkspaceService", () => {
  let db: ISqlDatabase;
  let workspaceService: WorkspaceService;
  const user1 = "usr_test_1";
  const user2 = "usr_test_2";

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    // Seed test users
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(user1, "u1@test.com", "hash1", "Alice", now, now);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(user2, "u2@test.com", "hash2", "Bob", now, now);

    workspaceService = new WorkspaceService(db);
  });

  afterEach(() => {
    closeDb();
  });

  it("ensures default workspace exists and retrieves it", () => {
    const defaultWs = workspaceService.ensureDefaultWorkspace(user1, "Alice");
    expect(defaultWs).toBeDefined();
    expect(defaultWs.name).toContain("Alice's Workspace");
    expect(defaultWs.is_default).toBe(1);

    const list = workspaceService.listWorkspaces(user1);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(defaultWs.id);
  });

  it("creates custom workspaces and maintains account isolation", () => {
    const ws1 = workspaceService.createWorkspace({
      userId: user1,
      name: "Engineering",
      description: "Engineering tasks",
      color: "#10B981",
      icon: "laptop",
    });
    expect(ws1.name).toBe("Engineering");
    expect(ws1.color).toBe("#10B981");

    // User2 list should not see User1's workspace
    const user2List = workspaceService.listWorkspaces(user2);
    expect(user2List.some((w) => w.id === ws1.id)).toBe(false);

    // User1 list should see both default and custom
    const user1List = workspaceService.listWorkspaces(user1);
    expect(user1List.some((w) => w.id === ws1.id)).toBe(true);
  });

  it("updates workspace attributes", () => {
    const ws = workspaceService.createWorkspace({
      userId: user1,
      name: "Old Name",
    });

    const updated = workspaceService.updateWorkspace(ws.id, user1, {
      name: "New Name",
      color: "#F59E0B",
    });

    expect(updated.name).toBe("New Name");
    expect(updated.color).toBe("#F59E0B");
  });

  it("cannot delete the only workspace", () => {
    const defaultWs = workspaceService.ensureDefaultWorkspace(user1, "Alice");
    expect(() => workspaceService.deleteWorkspace(defaultWs.id, user1)).toThrow(
      "Cannot delete your only workspace"
    );
  });
});
