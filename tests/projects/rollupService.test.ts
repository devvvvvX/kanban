import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { EpicService } from "../../src/lib/projects/epicService";
import { RollupService } from "../../src/lib/projects/rollupService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("RollupService (PROJ-05, EPIC-03, EPIC-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let epicService: EpicService;
  let rollupService: RollupService;
  let user1Id: string;
  let user2Id: string;
  let project1Id: string;
  let epic1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    epicService = new EpicService(db);
    rollupService = new RollupService(db);

    const u1 = await authService.register("rollup-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("rollup-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Desktop Client",
    });
    project1Id = p1.id;

    const e1 = epicService.createEpic({
      userId: user1Id,
      projectId: project1Id,
      title: "Navigation & Sidebar",
    });
    epic1Id = e1.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("calculates zero metrics gracefully before tickets table or data exists", () => {
    const metrics = rollupService.getProjectMetrics(project1Id, user1Id);
    expect(metrics.totalEpics).toBe(1);
    expect(metrics.totalTickets).toBe(0);
    expect(metrics.completionRate).toBe(0);

    const epicRollup = rollupService.getEpicRollup(epic1Id, user1Id);
    expect(epicRollup.totalTickets).toBe(0);
    expect(epicRollup.completedTickets).toBe(0);
    expect(epicRollup.progressPercentage).toBe(0);
  });

  it("calculates metrics accurately without double-counting subtasks", () => {
    const wfService = new WorkflowStateService(db);
    const states = wfService.ensureDefaultStates(project1Id, user1Id);
    const todoState = states[1];
    const inProgressState = states[2];
    const doneState = states[3];

    const insertTicket = db.prepare(`
      INSERT INTO tickets (
        id, user_id, project_id, epic_id, workflow_state_id, parent_id, ticket_number, identifier, title, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    // Top-level tickets:
    // 1. Ticket A - todo (open)
    insertTicket.run("t-1", user1Id, project1Id, epic1Id, todoState.id, null, 1, "APP-1", "Ticket A", now, now);
    // 2. Ticket B - in_progress
    insertTicket.run("t-2", user1Id, project1Id, epic1Id, inProgressState.id, null, 2, "APP-2", "Ticket B", now, now);
    // 3. Ticket C - done
    insertTicket.run("t-3", user1Id, project1Id, epic1Id, doneState.id, null, 3, "APP-3", "Ticket C", now, now);
    // 4. Ticket D - done (no epic)
    insertTicket.run("t-4", user1Id, project1Id, null, doneState.id, null, 4, "APP-4", "Ticket D", now, now);

    // Subtasks under Ticket B (parent_id = 't-2'):
    // These MUST NOT be double-counted in top-level ticket counts or epic progress
    insertTicket.run("sub-1", user1Id, project1Id, epic1Id, doneState.id, "t-2", 5, "APP-5", "Subtask 1", now, now);
    insertTicket.run("sub-2", user1Id, project1Id, epic1Id, doneState.id, "t-2", 6, "APP-6", "Subtask 2", now, now);
    insertTicket.run("sub-3", user1Id, project1Id, epic1Id, todoState.id, "t-2", 7, "APP-7", "Subtask 3", now, now);

    // Project metrics verification:
    // Total top-level tickets = 4 (t-1, t-2, t-3, t-4)
    // Open = 1 (t-1), In Progress = 1 (t-2), Completed = 2 (t-3, t-4)
    // Completion rate = 2 / 4 = 50%
    const projectMetrics = rollupService.getProjectMetrics(project1Id, user1Id);
    expect(projectMetrics.totalTickets).toBe(4);
    expect(projectMetrics.openTickets).toBe(1);
    expect(projectMetrics.inProgressTickets).toBe(1);
    expect(projectMetrics.completedTickets).toBe(2);
    expect(projectMetrics.completionRate).toBe(50);
    expect(projectMetrics.totalEpics).toBe(1);

    // Epic rollup verification for epic1:
    // Top-level tickets in epic1 = 3 (t-1, t-2, t-3)
    // Completed = 1 (t-3)
    // Progress = 1 / 3 = 33%
    const epicRollup = rollupService.getEpicRollup(epic1Id, user1Id);
    expect(epicRollup.totalTickets).toBe(3);
    expect(epicRollup.completedTickets).toBe(1);
    expect(epicRollup.progressPercentage).toBe(33);
  });

  it("enforces strict account isolation on rollup queries", () => {
    expect(() => rollupService.getProjectMetrics(project1Id, user2Id)).toThrow(
      /Project not found or access denied/
    );
    expect(() => rollupService.getEpicRollup(epic1Id, user2Id)).toThrow(
      /Epic not found or access denied/
    );
  });
});
