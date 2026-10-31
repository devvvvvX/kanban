import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { DependencyService } from "../../src/lib/tickets/dependencyService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("DependencyService (RELN-01, RELN-02)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let dependencyService: DependencyService;
  let user1Id: string;
  let user2Id: string;
  let ticketAId: string;
  let ticketBId: string;
  let ticketCId: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    dependencyService = new DependencyService(db);

    const u1 = await authService.register("dep-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("dep-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Dependency Tracking",
    });
    const states = workflowStateService.ensureDefaultStates(p1.id, user1Id);
    const todoState = states.find((s) => s.category === "unstarted")!;

    const tA = ticketService.createTicket({
      userId: user1Id,
      projectId: p1.id,
      workflowStateId: todoState.id,
      title: "Backend API Auth",
    });
    ticketAId = tA.id;

    const tB = ticketService.createTicket({
      userId: user1Id,
      projectId: p1.id,
      workflowStateId: todoState.id,
      title: "Frontend Login Screen",
    });
    ticketBId = tB.id;

    const tC = ticketService.createTicket({
      userId: user1Id,
      projectId: p1.id,
      workflowStateId: todoState.id,
      title: "E2E Integration Tests",
    });
    ticketCId = tC.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("creates reciprocal links for related, duplicate, and blocking relationships (RELN-01)", () => {
    // Ticket A blocks Ticket B
    const result = dependencyService.linkTickets(user1Id, ticketAId, ticketBId, "blocks");
    expect(result.link.relationship_type).toBe("blocks");
    expect(result.reciprocalLink.relationship_type).toBe("is_blocked_by");

    // Check Ticket A's dependencies
    const depsA = dependencyService.getDependencies(user1Id, ticketAId);
    expect(depsA).toHaveLength(1);
    expect(depsA[0].target_ticket_id).toBe(ticketBId);
    expect(depsA[0].relationship_type).toBe("blocks");
    expect(depsA[0].target_ticket_title).toBe("Frontend Login Screen");

    // Check Ticket B's dependencies (reciprocal!)
    const depsB = dependencyService.getDependencies(user1Id, ticketBId);
    expect(depsB).toHaveLength(1);
    expect(depsB[0].target_ticket_id).toBe(ticketAId);
    expect(depsB[0].relationship_type).toBe("is_blocked_by");
    expect(depsB[0].target_ticket_title).toBe("Backend API Auth");
  });

  it("rejects self-dependencies immediately", () => {
    expect(() =>
      dependencyService.linkTickets(user1Id, ticketAId, ticketAId, "blocks")
    ).toThrow(/A ticket cannot depend on itself/);
  });

  it("detects and prevents direct 2-ticket blocking cycles (RELN-02)", () => {
    // A blocks B
    dependencyService.linkTickets(user1Id, ticketAId, ticketBId, "blocks");

    // Attempt B blocks A -> circular!
    expect(() =>
      dependencyService.linkTickets(user1Id, ticketBId, ticketAId, "blocks")
    ).toThrow(/Circular dependency detected/);

    // Attempt A is_blocked_by B -> circular!
    expect(() =>
      dependencyService.linkTickets(user1Id, ticketAId, ticketBId, "is_blocked_by")
    ).toThrow(/Circular dependency detected/);
  });

  it("detects and prevents transitive multi-hop blocking cycles (RELN-02)", () => {
    // A blocks B, B blocks C
    dependencyService.linkTickets(user1Id, ticketAId, ticketBId, "blocks");
    dependencyService.linkTickets(user1Id, ticketBId, ticketCId, "blocks");

    // Attempt C blocks A -> cycle: A -> B -> C -> A
    expect(() =>
      dependencyService.linkTickets(user1Id, ticketCId, ticketAId, "blocks")
    ).toThrow(/Circular dependency detected/);

    // Attempt A is_blocked_by C -> cycle: C -> A -> B -> C
    expect(() =>
      dependencyService.linkTickets(user1Id, ticketAId, ticketCId, "is_blocked_by")
    ).toThrow(/Circular dependency detected/);
  });

  it("unlinks dependencies cleanly removing both forward and reciprocal records", () => {
    dependencyService.linkTickets(user1Id, ticketAId, ticketBId, "relates_to");

    let depsA = dependencyService.getDependencies(user1Id, ticketAId);
    expect(depsA).toHaveLength(1);
    const linkId = depsA[0].id;

    dependencyService.unlinkTickets(user1Id, linkId);

    depsA = dependencyService.getDependencies(user1Id, ticketAId);
    expect(depsA).toHaveLength(0);

    const depsB = dependencyService.getDependencies(user1Id, ticketBId);
    expect(depsB).toHaveLength(0);
  });

  it("enforces multi-account isolation", () => {
    expect(() =>
      dependencyService.linkTickets(user2Id, ticketAId, ticketBId, "blocks")
    ).toThrow(/One or both tickets not found or unauthorized/);

    dependencyService.linkTickets(user1Id, ticketAId, ticketBId, "blocks");
    expect(dependencyService.getDependencies(user2Id, ticketAId)).toHaveLength(0);
  });
});
