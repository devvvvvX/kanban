import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import type { ISqlDatabase } from "../../src/lib/db/types";

const mockUser = {
  id: "ticket-context-user",
  email: "tc@mac.local",
  password_hash: "hash",
  display_name: "TC User",
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

describe("TicketContext Integration (TICK-01, TICK-03, TICK-04)", () => {
  let db: ISqlDatabase;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let projectId: string;

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

    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);

    const proj = projectService.createProject({
      userId: mockUser.id,
      name: "Desktop Kanban App",
    });
    projectId = proj.id;
  });

  afterEach(() => {
    closeDb();
    vi.restoreAllMocks();
  });

  it("manages workflow states and tickets grouping", () => {
    // 1. Initialize states
    const states = workflowStateService.ensureDefaultStates(projectId, mockUser.id);
    expect(states).toHaveLength(4);

    // 2. Create tickets across states
    const t1 = ticketService.createTicket({
      userId: mockUser.id,
      projectId,
      workflowStateId: states[0].id, // Backlog
      title: "Write documentation",
      priority: "low",
    });

    const t2 = ticketService.createTicket({
      userId: mockUser.id,
      projectId,
      workflowStateId: states[1].id, // Todo
      title: "Implement shortcuts",
      priority: "high",
    });

    // 3. Verify grouping logic
    const all = ticketService.listTickets(projectId, mockUser.id);
    expect(all).toHaveLength(2);

    const map: Record<string, typeof all> = {};
    states.forEach((s) => {
      map[s.id] = all.filter((t) => t.workflow_state_id === s.id);
    });

    expect(map[states[0].id]).toHaveLength(1);
    expect(map[states[0].id][0].id).toBe(t1.id);
    expect(map[states[1].id]).toHaveLength(1);
    expect(map[states[1].id][0].id).toBe(t2.id);
    expect(map[states[2].id]).toHaveLength(0); // In Progress
  });
});
