import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { EpicService } from "../../src/lib/projects/epicService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("TicketService (TICK-01, TICK-02, TICK-03, TICK-05, KANB-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let epicService: EpicService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
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
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);

    const u1 = await authService.register("tick-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("tick-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Desktop Kanban",
    });
    project1Id = p1.id;

    const e1 = epicService.createEpic({
      userId: user1Id,
      projectId: project1Id,
      title: "Core UX",
    });
    epic1Id = e1.id;

    // Ensure default states
    workflowStateService.ensureDefaultStates(project1Id, user1Id);
  });

  afterEach(() => {
    closeDb();
  });

  it("TICK-02: generates human-readable identifiers formatted with project key", () => {
    const key = ticketService.generateProjectKey("Desktop Kanban");
    expect(key).toBe("DKE"); // DK + E

    const t1 = ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      title: "Implement drag and drop",
    });

    expect(t1.ticket_number).toBe(1);
    expect(t1.identifier).toBe(`${key}-1`);

    const t2 = ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      title: "Setup SQLite migrations",
    });

    expect(t2.ticket_number).toBe(2);
    expect(t2.identifier).toBe(`${key}-2`);

    // Lookup by identifier
    const found = ticketService.getTicketByIdentifier(project1Id, t2.identifier, user1Id);
    expect(found?.id).toBe(t2.id);
  });

  it("TICK-03 & TICK-04: creates and updates tickets with Markdown description, priorities, labels, and estimates", () => {
    const t = ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      epicId: epic1Id,
      title: "Design card elevation",
      description: "### Criteria\n- Use subtle shadow\n- Support dark mode",
      priority: "high",
      labels: ["frontend", "ui"],
      dueDate: "2026-11-01",
      estimate: 3,
    });

    expect(t.title).toBe("Design card elevation");
    expect(t.priority).toBe("high");
    expect(t.labels).toEqual(["frontend", "ui"]);
    expect(t.due_date).toBe("2026-11-01");
    expect(t.estimate).toBe(3);
    expect(t.epic_id).toBe(epic1Id);

    // Update ticket
    const updated = ticketService.updateTicket(t.id, user1Id, {
      title: "Design card elevation and hover state",
      priority: "urgent",
      labels: ["frontend", "ui", "polish"],
      estimate: 5,
    });

    expect(updated.title).toBe("Design card elevation and hover state");
    expect(updated.priority).toBe("urgent");
    expect(updated.labels).toEqual(["frontend", "ui", "polish"]);
    expect(updated.estimate).toBe(5);
  });

  it("KANB-04: moves tickets between workflow states", () => {
    const states = workflowStateService.listStates(project1Id, user1Id);
    const todoState = states[1];
    const inProgressState = states[2];

    const t = ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      workflowStateId: todoState.id,
      title: "Move me",
    });

    expect(t.workflow_state_id).toBe(todoState.id);

    // Move to in_progress
    const moved = ticketService.moveTicket(t.id, user1Id, inProgressState.id, 10);
    expect(moved.workflow_state_id).toBe(inProgressState.id);
    expect(moved.position).toBe(10);
  });

  it("TICK-05: duplicates, archives, restores, and deletes tickets with strict account isolation", () => {
    const t = ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      title: "Original Ticket",
      priority: "medium",
      labels: ["bug"],
    });

    // Duplicate
    const dup = ticketService.duplicateTicket(t.id, user1Id);
    expect(dup.id).not.toBe(t.id);
    expect(dup.title).toBe("Original Ticket (Copy)");
    expect(dup.ticket_number).toBe(t.ticket_number + 1);
    expect(dup.labels).toEqual(["bug"]);

    // Archive
    ticketService.archiveTicket(t.id, user1Id);
    let active = ticketService.listTickets(project1Id, user1Id);
    expect(active.some((item) => item.id === t.id)).toBe(false);

    // List archived tickets
    const archived = ticketService.listArchivedTickets(user1Id, project1Id);
    expect(archived.some((item) => item.id === t.id)).toBe(true);
    const archivedViaOptions = ticketService.listTickets(project1Id, user1Id, { onlyArchived: true });
    expect(archivedViaOptions.some((item) => item.id === t.id)).toBe(true);

    // Restore
    ticketService.restoreTicket(t.id, user1Id);
    active = ticketService.listTickets(project1Id, user1Id);
    expect(active.some((item) => item.id === t.id)).toBe(true);
    const archivedAfterRestore = ticketService.listArchivedTickets(user1Id, project1Id);
    expect(archivedAfterRestore.some((item) => item.id === t.id)).toBe(false);

    // Account isolation: user2 cannot access user1's ticket
    expect(ticketService.getTicket(t.id, user2Id)).toBeNull();
    expect(() => ticketService.deleteTicket(t.id, user2Id)).toThrow(/not found/);

    // Delete
    ticketService.deleteTicket(t.id, user1Id);
    expect(ticketService.getTicket(t.id, user1Id)).toBeNull();
  });
});
