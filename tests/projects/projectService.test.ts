import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("ProjectService (PROJ-01, PROJ-02, PROJ-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);

    const u1 = await authService.register("user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("PROJ-01: creates projects with custom color and icon, validating name constraints", () => {
    // Empty name rejects
    expect(() =>
      projectService.createProject({
        userId: user1Id,
        name: "   ",
      })
    ).toThrow(/between 1 and 100/);

    // Valid project creation
    const project = projectService.createProject({
      userId: user1Id,
      name: "Tauri Desktop Kanban",
      description: "Personal desktop app for macOS",
      color: "#10B981",
      icon: "layout",
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe("Tauri Desktop Kanban");
    expect(project.description).toBe("Personal desktop app for macOS");
    expect(project.color).toBe("#10B981");
    expect(project.icon).toBe("layout");
    expect(project.is_pinned).toBe(0);
    expect(project.is_archived).toBe(0);
  });

  it("PROJ-02: pins and unpins projects with sorting priority", () => {
    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Project Beta",
    });
    const p2 = projectService.createProject({
      userId: user1Id,
      name: "Project Alpha",
    });

    // Initially both unpinned
    let list = projectService.listProjects(user1Id);
    expect(list.length).toBe(2);
    expect(list.some(p => p.id === p2.id)).toBe(true);

    // Pin p1
    projectService.togglePin(p1.id, user1Id);
    list = projectService.listProjects(user1Id);
    expect(list[0].id).toBe(p1.id);
    expect(list[0].is_pinned).toBe(1);

    // Filter only pinned
    const pinnedList = projectService.listProjects(user1Id, { onlyPinned: true });
    expect(pinnedList.length).toBe(1);
    expect(pinnedList[0].id).toBe(p1.id);

    // Unpin p1
    projectService.togglePin(p1.id, user1Id);
    const unpinnedList = projectService.listProjects(user1Id, { onlyPinned: true });
    expect(unpinnedList.length).toBe(0);
  });

  it("PROJ-04: archives, restores, and deletes projects, maintaining account isolation", () => {
    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Archivable Project",
    });

    // Account isolation: user2 cannot see or archive user1's project
    expect(projectService.getProject(p1.id, user2Id)).toBeNull();
    expect(() => projectService.archiveProject(p1.id, user2Id)).toThrow(/Project not found/);

    // Archive project
    projectService.archiveProject(p1.id, user1Id);

    // By default listProjects excludes archived
    let activeProjects = projectService.listProjects(user1Id);
    expect(activeProjects.find((p) => p.id === p1.id)).toBeUndefined();

    // With includeArchived option
    let allProjects = projectService.listProjects(user1Id, { includeArchived: true });
    expect(allProjects.find((p) => p.id === p1.id)?.is_archived).toBe(1);

    // Restore project
    projectService.restoreProject(p1.id, user1Id);
    activeProjects = projectService.listProjects(user1Id);
    expect(activeProjects.find((p) => p.id === p1.id)?.is_archived).toBe(0);

    // Delete project
    projectService.deleteProject(p1.id, user1Id);
    expect(projectService.getProject(p1.id, user1Id)).toBeNull();
  });
});
