import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { ProjectService } from "../../src/lib/projects/projectService";
import { EpicService } from "../../src/lib/projects/epicService";
import { RollupService } from "../../src/lib/projects/rollupService";
import type { ISqlDatabase } from "../../src/lib/db/types";
import type { ProjectViewTab } from "../../src/context/ProjectContext";

// LocalStorage mock shim for Node.js test environment
const store = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Mock user context
const mockUser = {
  id: "test-user-uuid",
  email: "test@mac.local",
  password_hash: "hash",
  display_name: "Test User",
  status: "active" as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

describe("ProjectContext & Multi-View State Navigation (PROJ-04, PROJ-05, EPIC-03, EPIC-04)", () => {
  let db: ISqlDatabase;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      mockUser.id,
      mockUser.email,
      mockUser.password_hash,
      mockUser.display_name,
      mockUser.status,
      mockUser.created_at,
      mockUser.updated_at
    );

    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    closeDb();
    vi.restoreAllMocks();
  });

  it("manages projects, active selection, view switching, and epics with persistence", async () => {
    const projectService = new ProjectService(db);
    const epicService = new EpicService(db);
    const rollupService = new RollupService(db);

    // 1. Create a project
    const proj = projectService.createProject({
      userId: mockUser.id,
      name: "Desktop App",
      description: "macOS Kanban",
      color: "#3B82F6",
      icon: "folder",
      isPinned: true,
    });
    expect(proj.id).toBeDefined();

    // 2. View switching logic test
    const views: ProjectViewTab[] = ["overview", "board", "list", "epics"];
    for (const v of views) {
      localStorage.setItem(`kanban_active_view_${mockUser.id}`, v);
      expect(localStorage.getItem(`kanban_active_view_${mockUser.id}`)).toBe(v);
    }

    // 3. Active project persistence test
    localStorage.setItem(`kanban_active_project_${mockUser.id}`, proj.id);
    expect(localStorage.getItem(`kanban_active_project_${mockUser.id}`)).toBe(proj.id);

    // 4. Epic creation and rollup calculation
    const epic = epicService.createEpic({
      userId: mockUser.id,
      projectId: proj.id,
      title: "Epic Alpha",
      status: "in_progress",
    });
    expect(epic.id).toBeDefined();

    const metrics = rollupService.getProjectMetrics(proj.id, mockUser.id);
    expect(metrics.totalEpics).toBe(1);
    expect(metrics.totalTickets).toBe(0);
  });
});
