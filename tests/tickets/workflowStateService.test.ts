import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("WorkflowStateService (KANB-01, KANB-02, KANB-03, KANB-05)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let user1Id: string;
  let user2Id: string;
  let project1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);

    const u1 = await authService.register("wf-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("wf-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Desktop App",
    });
    project1Id = p1.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("KANB-01: initializes 4 default workflow states with semantic categories", () => {
    const states = workflowStateService.ensureDefaultStates(project1Id, user1Id);
    expect(states).toHaveLength(4);
    expect(states[0].name).toBe("Backlog");
    expect(states[0].category).toBe("backlog");
    expect(states[1].name).toBe("Todo");
    expect(states[1].category).toBe("unstarted");
    expect(states[2].name).toBe("In Progress");
    expect(states[2].category).toBe("started");
    expect(states[2].wip_limit).toBe(5);
    expect(states[3].name).toBe("Done");
    expect(states[3].category).toBe("completed");
  });

  it("KANB-02 & KANB-03: creates, updates, recolors, sets WIP limits, and reorders states", () => {
    const states = workflowStateService.ensureDefaultStates(project1Id, user1Id);

    // Create custom state
    const custom = workflowStateService.createState({
      userId: user1Id,
      projectId: project1Id,
      name: "Code Review",
      category: "started",
      color: "#8B5CF6",
      wipLimit: 3,
    });

    expect(custom.name).toBe("Code Review");
    expect(custom.wip_limit).toBe(3);
    expect(custom.position).toBe(4);

    // Update state
    const updated = workflowStateService.updateState(custom.id, user1Id, {
      name: "Peer Review",
      wipLimit: 4,
    });
    expect(updated.name).toBe("Peer Review");
    expect(updated.wip_limit).toBe(4);

    // Reorder states
    workflowStateService.reorderStates(project1Id, user1Id, [
      custom.id,
      states[0].id,
      states[1].id,
      states[2].id,
      states[3].id,
    ]);

    const reordered = workflowStateService.listStates(project1Id, user1Id);
    expect(reordered[0].id).toBe(custom.id);
    expect(reordered[0].position).toBe(0);
  });

  it("KANB-05: safe state deletion migrates active tickets to destination state", () => {
    const states = workflowStateService.ensureDefaultStates(project1Id, user1Id);
    const todoState = states[1];
    const doneState = states[3];

    // Insert 2 tickets in todoState
    const now = new Date().toISOString();
    const insertTicket = db.prepare(`
      INSERT INTO tickets (
        id, user_id, project_id, workflow_state_id, ticket_number, identifier, title, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTicket.run("t-1", user1Id, project1Id, todoState.id, 1, "APP-1", "Task 1", now, now);
    insertTicket.run("t-2", user1Id, project1Id, todoState.id, 2, "APP-2", "Task 2", now, now);

    // Attempting to delete state without targetStateId throws error
    expect(() => workflowStateService.deleteState(todoState.id, user1Id)).toThrow(
      /Cannot delete state with 2 tickets without specifying a target state/
    );

    // Delete with destination target: doneState
    const res = workflowStateService.deleteState(todoState.id, user1Id, doneState.id);
    expect(res.migratedTicketsCount).toBe(2);

    // Verify todoState is deleted
    expect(workflowStateService.getState(todoState.id, user1Id)).toBeNull();

    // Verify tickets have been migrated to doneState
    const migrated = db.prepare("SELECT workflow_state_id FROM tickets WHERE id IN ('t-1', 't-2')").all() as Array<{ workflow_state_id: string }>;
    expect(migrated[0].workflow_state_id).toBe(doneState.id);
    expect(migrated[1].workflow_state_id).toBe(doneState.id);
  });

  it("enforces strict user account isolation on workflow states", () => {
    const states = workflowStateService.ensureDefaultStates(project1Id, user1Id);
    expect(workflowStateService.getState(states[0].id, user2Id)).toBeNull();
    expect(() => workflowStateService.deleteState(states[0].id, user2Id)).toThrow(/not found/);
  });
});
