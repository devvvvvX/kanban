import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { SubtaskService } from "../../src/lib/tickets/subtaskService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("SubtaskService (SUBT-01, SUBT-02, SUBT-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let subtaskService: SubtaskService;
  let user1Id: string;
  let user2Id: string;
  let ticket1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    subtaskService = new SubtaskService(db);

    const u1 = await authService.register("subtask-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("subtask-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Subtask Project",
    });
    const states = workflowStateService.ensureDefaultStates(p1.id, user1Id);
    const todoState = states.find((s) => s.category === "unstarted")!;

    const t1 = ticketService.createTicket({
      userId: user1Id,
      projectId: p1.id,
      workflowStateId: todoState.id,
      title: "Parent Ticket with Subtasks",
    });
    ticket1Id = t1.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("creates, retrieves, and calculates progress for subtasks (SUBT-01)", () => {
    const s1 = subtaskService.createSubtask(user1Id, ticket1Id, "First checklist item");
    const s2 = subtaskService.createSubtask(user1Id, ticket1Id, "Second checklist item");

    expect(s1.title).toBe("First checklist item");
    expect(s1.is_completed).toBe(false);
    expect(s2.position).toBeGreaterThan(s1.position);

    const list = subtaskService.getSubtasks(user1Id, ticket1Id);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(s1.id);
    expect(list[1].id).toBe(s2.id);

    const initialProgress = subtaskService.getProgress(user1Id, ticket1Id);
    expect(initialProgress).toEqual({ total: 2, completed: 0, percentage: 0 });
  });

  it("updates title and toggles completion without affecting parent ticket status (SUBT-02, SUBT-04)", () => {
    const s1 = subtaskService.createSubtask(user1Id, ticket1Id, "Draft documentation");

    // Toggle completion to true
    const toggled = subtaskService.toggleCompletion(user1Id, s1.id);
    expect(toggled.is_completed).toBe(true);

    const progressAfterOne = subtaskService.getProgress(user1Id, ticket1Id);
    expect(progressAfterOne).toEqual({ total: 1, completed: 1, percentage: 100 });

    // Verify parent ticket has NOT been modified or auto-completed (SUBT-04)
    const parentTicket = ticketService.getTicket(ticket1Id, user1Id);
    expect(parentTicket).not.toBeNull();
    // Workflow state is still the original unstarted state
    const states = workflowStateService.listStates(parentTicket!.project_id, user1Id);
    const currentState = states.find((s) => s.id === parentTicket!.workflow_state_id);
    expect(currentState?.category).toBe("unstarted");

    // Edit subtask title
    const edited = subtaskService.updateSubtask(user1Id, s1.id, { title: "Draft complete documentation" });
    expect(edited.title).toBe("Draft complete documentation");

    // Toggle back to false
    const untoggled = subtaskService.toggleCompletion(user1Id, s1.id);
    expect(untoggled.is_completed).toBe(false);
  });

  it("reorders subtasks and deletes subtasks cleanly (SUBT-01, SUBT-02)", () => {
    const s1 = subtaskService.createSubtask(user1Id, ticket1Id, "Step 1");
    const s2 = subtaskService.createSubtask(user1Id, ticket1Id, "Step 2");
    const s3 = subtaskService.createSubtask(user1Id, ticket1Id, "Step 3");

    // Reorder: 3, 1, 2
    subtaskService.reorderSubtasks(user1Id, ticket1Id, [s3.id, s1.id, s2.id]);
    const reordered = subtaskService.getSubtasks(user1Id, ticket1Id);
    expect(reordered.map((s) => s.id)).toEqual([s3.id, s1.id, s2.id]);

    // Delete step 2
    subtaskService.deleteSubtask(user1Id, s2.id);
    const remaining = subtaskService.getSubtasks(user1Id, ticket1Id);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((s) => s.id)).toEqual([s3.id, s1.id]);
  });

  it("enforces multi-account isolation strictly", () => {
    const s1 = subtaskService.createSubtask(user1Id, ticket1Id, "Confidential subtask");

    expect(() => subtaskService.createSubtask(user2Id, ticket1Id, "Hacker subtask")).toThrow(
      /Ticket not found or unauthorized/
    );

    expect(subtaskService.getSubtasks(user2Id, ticket1Id)).toHaveLength(0);

    expect(() => subtaskService.updateSubtask(user2Id, s1.id, { title: "Tampered" })).toThrow(
      /Subtask not found or unauthorized/
    );

    expect(() => subtaskService.deleteSubtask(user2Id, s1.id)).toThrow(
      /Subtask not found or unauthorized/
    );
  });
});
