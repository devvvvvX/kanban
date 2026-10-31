import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { EpicService } from "../../src/lib/projects/epicService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("EpicService (PROJ-03, PROJ-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let epicService: EpicService;
  let user1Id: string;
  let user2Id: string;
  let project1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    epicService = new EpicService(db);

    const u1 = await authService.register("epic-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("epic-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Core Platform",
    });
    project1Id = p1.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("PROJ-03: creates epics under a project with custom attributes and date validation", () => {
    // Fails on invalid dates (start after target)
    expect(() =>
      epicService.createEpic({
        userId: user1Id,
        projectId: project1Id,
        title: "Auth Refactor",
        startDate: "2026-05-10",
        targetDate: "2026-05-01",
      })
    ).toThrow(/Start date cannot be after target completion date/);

    // Fails on invalid project access (user2 creating under user1's project)
    expect(() =>
      epicService.createEpic({
        userId: user2Id,
        projectId: project1Id,
        title: "Unauthorized Epic",
      })
    ).toThrow(/Project not found or access denied/);

    // Successfully creates epic
    const epic = epicService.createEpic({
      userId: user1Id,
      projectId: project1Id,
      title: "Local Database Migration",
      description: "Upgrade schema and add SQLite indexes",
      color: "#8B5CF6",
      icon: "database",
      status: "in_progress",
      startDate: "2026-05-01",
      targetDate: "2026-05-20",
    });

    expect(epic.id).toBeDefined();
    expect(epic.title).toBe("Local Database Migration");
    expect(epic.status).toBe("in_progress");
    expect(epic.color).toBe("#8B5CF6");
    expect(epic.icon).toBe("database");
    expect(epic.start_date).toBe("2026-05-01");
    expect(epic.target_date).toBe("2026-05-20");
    expect(epic.is_archived).toBe(0);
  });

  it("PROJ-03 & PROJ-04: updates epic status, dates, and filters by status", () => {
    const e1 = epicService.createEpic({
      userId: user1Id,
      projectId: project1Id,
      title: "Epic One",
      status: "planned",
    });

    const e2 = epicService.createEpic({
      userId: user1Id,
      projectId: project1Id,
      title: "Epic Two",
      status: "in_progress",
    });

    // List all active epics
    const all = epicService.listEpics(project1Id, user1Id);
    expect(all.length).toBe(2);

    // Filter by status 'in_progress'
    const inProgress = epicService.listEpics(project1Id, user1Id, { status: "in_progress" });
    expect(inProgress.length).toBe(1);
    expect(inProgress[0].id).toBe(e2.id);

    // Update epic status and dates
    const updated = epicService.updateEpic(e1.id, user1Id, {
      status: "completed",
      targetDate: "2026-06-01",
    });
    expect(updated.status).toBe("completed");
    expect(updated.target_date).toBe("2026-06-01");

    // Archive epic
    epicService.archiveEpic(e1.id, user1Id);
    const activeEpics = epicService.listEpics(project1Id, user1Id);
    expect(activeEpics.length).toBe(1);
    expect(activeEpics[0].id).toBe(e2.id);

    // Cascade delete on project deletion
    projectService.deleteProject(project1Id, user1Id);
    expect(epicService.getEpic(e2.id, user1Id)).toBeNull();
  });
});
