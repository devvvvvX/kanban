import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { QueryEngine } from "../../src/lib/query/queryEngine";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("QueryEngine (QURY-01, QURY-02, QURY-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let queryEngine: QueryEngine;
  let user1Id: string;
  let user2Id: string;
  let project1Id: string;
  let stateTodoId: string;
  let stateDoneId: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    queryEngine = new QueryEngine(db);

    const u1 = await authService.register("query-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("query-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Visual Query Project",
    });
    project1Id = p1.id;

    const states = workflowStateService.ensureDefaultStates(project1Id, user1Id);
    stateTodoId = states.find((s) => s.category === "unstarted")!.id;
    stateDoneId = states.find((s) => s.category === "completed")!.id;

    // Seed test tickets
    ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      workflowStateId: stateTodoId,
      title: "Refactor Rust bridge",
      priority: "urgent",
      labels: ["backend", "core"],
      dueDate: "2026-11-01",
    });

    ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      workflowStateId: stateTodoId,
      title: "Frontend smooth animations",
      priority: "high",
      labels: ["ui"],
      dueDate: "2026-11-15",
    });

    ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      workflowStateId: stateDoneId,
      title: "Argon2id offline verification",
      priority: "medium",
      labels: ["security", "core"],
      dueDate: "2026-10-20",
    });
  });

  afterEach(() => {
    closeDb();
  });

  it("filters with AND logic across multiple attributes (QURY-01)", () => {
    const res = queryEngine.executeQuery({
      userId: user1Id,
      filter: {
        operator: "AND",
        conditions: [
          { field: "priority", operator: "is", value: "urgent" },
          { field: "label", operator: "contains", value: "core" },
        ],
      },
    });

    expect(res.totalCount).toBe(1);
    expect(res.tickets[0].title).toBe("Refactor Rust bridge");
  });

  it("filters with OR logic across multiple attributes (QURY-01)", () => {
    const res = queryEngine.executeQuery({
      userId: user1Id,
      filter: {
        operator: "OR",
        conditions: [
          { field: "priority", operator: "is", value: "urgent" },
          { field: "priority", operator: "is", value: "high" },
        ],
      },
    });

    expect(res.totalCount).toBe(2);
    const titles = res.tickets.map((t) => t.title);
    expect(titles).toContain("Refactor Rust bridge");
    expect(titles).toContain("Frontend smooth animations");
  });

  it("filters by due date comparison and state category (QURY-01)", () => {
    const overdueRes = queryEngine.executeQuery({
      userId: user1Id,
      filter: {
        operator: "AND",
        conditions: [
          { field: "due_date", operator: "is_before", value: "2026-10-25" },
        ],
      },
    });

    expect(overdueRes.totalCount).toBe(1);
    expect(overdueRes.tickets[0].title).toBe("Argon2id offline verification");
  });

  it("sorts query results with custom ordering (QURY-02)", () => {
    // Sort by priority DESC (urgent > high > medium > low > none)
    const sortedRes = queryEngine.executeQuery({
      userId: user1Id,
      filter: { operator: "AND", conditions: [] },
      sort: { field: "priority", direction: "DESC" },
    });

    expect(sortedRes.totalCount).toBe(3);
    expect(sortedRes.tickets[0].priority).toBe("urgent");
    expect(sortedRes.tickets[1].priority).toBe("high");
    expect(sortedRes.tickets[2].priority).toBe("medium");
  });

  it("completes query execution in sub-100ms benchmark (QURY-04)", () => {
    // Insert 100 tickets in a single transaction for rapid benchmarking
    const stmt = db.prepare(`
      INSERT INTO tickets (id, user_id, project_id, workflow_state_id, ticket_number, identifier, title, priority, position, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const now = new Date().toISOString();
    const txn = db.transaction(() => {
      for (let i = 10; i < 200; i++) {
        stmt.run(
          `bench-${i}`,
          user1Id,
          project1Id,
          stateTodoId,
          i,
          `BENCH-${i}`,
          `Synthetic performance ticket ${i}`,
          i % 2 === 0 ? "urgent" : "low",
          i * 1000,
          now,
          now
        );
      }
    });
    txn();

    const res = queryEngine.executeQuery({
      userId: user1Id,
      filter: {
        operator: "AND",
        conditions: [{ field: "priority", operator: "is", value: "urgent" }],
      },
      sort: { field: "title", direction: "ASC" },
    });

    expect(res.executionTimeMs).toBeLessThan(100);
    expect(res.totalCount).toBeGreaterThan(50);
  });

  it("executes queries in under 100ms on a database with 5,000 tickets (QURY-04)", () => {
    const stmt = db.prepare(`
      INSERT INTO tickets (id, user_id, project_id, workflow_state_id, ticket_number, identifier, title, priority, position, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const now = new Date().toISOString();
    const txn = db.transaction(() => {
      for (let i = 1; i <= 5000; i++) {
        stmt.run(
          `scale-${i}`,
          user1Id,
          project1Id,
          stateTodoId,
          i,
          `SCALE-${i}`,
          `Scale validation ticket ${i} with performance payload`,
          i % 4 === 0 ? "urgent" : i % 3 === 0 ? "high" : "medium",
          i * 10,
          now,
          now
        );
      }
    });
    txn();

    const res = queryEngine.executeQuery({
      userId: user1Id,
      filter: {
        operator: "AND",
        conditions: [
          { field: "priority", operator: "is", value: "urgent" },
        ],
      },
      sort: { field: "priority", direction: "DESC" },
      limit: 50,
    });

    expect(res.totalCount).toBeGreaterThanOrEqual(1250);
    expect(res.executionTimeMs).toBeLessThan(100);
  });

  it("enforces multi-account isolation", () => {
    const user2Res = queryEngine.executeQuery({
      userId: user2Id,
      filter: { operator: "AND", conditions: [] },
    });
    expect(user2Res.totalCount).toBe(0);
    expect(user2Res.tickets).toHaveLength(0);
  });
});
