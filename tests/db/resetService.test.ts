import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { DatabaseResetService } from "../../src/lib/db/resetService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("DatabaseResetService", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let stateService: WorkflowStateService;
  let resetService: DatabaseResetService;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    stateService = new WorkflowStateService(db);
    resetService = new DatabaseResetService(db);

    const u1 = await authService.register("developer1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("developer2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    // Create custom project & tickets for user 1
    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Sprint Alpha",
    });
    const states = stateService.ensureDefaultStates(p1.id, user1Id);

    db.prepare(`
      INSERT INTO tickets (id, user_id, project_id, workflow_state_id, ticket_number, identifier, title, priority, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "ticket-1",
      user1Id,
      p1.id,
      states[0].id,
      1,
      "PROJ-1",
      "Implement feature",
      "high",
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(`
      INSERT INTO saved_queries (id, user_id, name, filter_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "query-1",
      user1Id,
      "High Priority",
      JSON.stringify({ operator: "AND", conditions: [] }),
      new Date().toISOString(),
      new Date().toISOString()
    );
  });

  afterEach(() => {
    closeDb();
  });

  it("resets all operational workspace data while strictly preserving user accounts and authentication info", async () => {
    // Verify tickets and saved queries exist before reset
    const beforeTickets = db.prepare("SELECT COUNT(*) as count FROM tickets").get() as { count: number };
    expect(beforeTickets.count).toBe(1);

    const beforeQueries = db.prepare("SELECT COUNT(*) as count FROM saved_queries").get() as { count: number };
    expect(beforeQueries.count).toBe(1);

    const res = await resetService.resetWorkspaceData();
    expect(res.success).toBe(true);
    expect(res.preservedUsersCount).toBe(2);

    // Verify all old tickets, projects, and queries are cleared
    const afterTickets = db.prepare("SELECT COUNT(*) as count FROM tickets").get() as { count: number };
    expect(afterTickets.count).toBe(0);

    const afterQueries = db.prepare("SELECT COUNT(*) as count FROM saved_queries").get() as { count: number };
    expect(afterQueries.count).toBe(0);

    // Verify users, recovery verifiers, and sessions are PRESERVED
    const preservedUsers = db.prepare("SELECT id, email FROM users ORDER BY email ASC").all() as Array<{ id: string; email: string }>;
    expect(preservedUsers.length).toBe(2);
    expect(preservedUsers[0].email).toBe("developer1@mac.local");
    expect(preservedUsers[1].email).toBe("developer2@mac.local");
    expect(preservedUsers[1].id).toBe(user2Id);

    const recoveryVerifiers = db.prepare("SELECT COUNT(*) as count FROM recovery_verifiers").get() as { count: number };
    expect(recoveryVerifiers.count).toBe(2);

    // Verify default workspace and project were re-seeded for each preserved user
    const defaultProjects = db.prepare("SELECT * FROM projects WHERE name = 'Personal Projects'").all() as Array<{ user_id: string }>;
    expect(defaultProjects.length).toBe(2);

    const user1States = stateService.listStates(defaultProjects[0].user_id === user1Id ? (defaultProjects[0] as any).id : (defaultProjects[1] as any).id, user1Id);
    expect(user1States.length).toBe(4);
    expect(user1States.map((s) => s.name)).toEqual(["Backlog", "Todo", "In Progress", "Done"]);
  });

  it("performs full factory reset wiping everything including user accounts", async () => {
    await resetService.fullFactoryReset();

    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    expect(usersCount.count).toBe(0);

    const ticketsCount = db.prepare("SELECT COUNT(*) as count FROM tickets").get() as { count: number };
    expect(ticketsCount.count).toBe(0);

    const projectsCount = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
    expect(projectsCount.count).toBe(0);
  });
});
