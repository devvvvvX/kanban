import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { EpicService } from "../../src/lib/projects/epicService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { SearchService, highlightMatches } from "../../src/lib/search/searchService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("SearchService & Highlighting (SRCH-01, SRCH-02)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let epicService: EpicService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let searchService: SearchService;
  let user1Id: string;
  let user2Id: string;
  let project1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);

    authService = new AuthService(db);
    projectService = new ProjectService(db);
    epicService = new EpicService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    searchService = new SearchService(db);

    const u1 = await authService.register("search-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("search-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Desktop Application",
      description: "Native macOS Kanban and Project Manager",
    });
    project1Id = p1.id;

    epicService.createEpic({
      userId: user1Id,
      projectId: project1Id,
      title: "Model Context Protocol Integration",
      description: "Native stdio transport conforming to MCP specifications",
    });

    const states = workflowStateService.ensureDefaultStates(project1Id, user1Id);
    const todoState = states.find((s) => s.category === "unstarted")!;

    ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      workflowStateId: todoState.id,
      title: "Implement visual query builder",
      description: "Support combinable AND/OR filters with sub-100ms response time",
    });

    ticketService.createTicket({
      userId: user1Id,
      projectId: project1Id,
      workflowStateId: todoState.id,
      title: "Spotlight Cmd+K command palette",
      description: "Global keyboard driven fuzzy search modal",
    });
  });

  afterEach(() => {
    closeDb();
  });

  it("calculates match highlight fragments correctly (SRCH-02)", () => {
    const text = "Desktop Application Shell";
    const fragments = highlightMatches(text, "app");

    expect(fragments).toEqual([
      { text: "Desktop ", isMatch: false },
      { text: "App", isMatch: true },
      { text: "lication Shell", isMatch: false },
    ]);
  });

  it("performs multi-entity search across tickets, epics, and projects (SRCH-01, SRCH-02)", () => {
    // Search query 'query' matches ticket 'Implement visual query builder'
    const res1 = searchService.search(user1Id, "query");
    expect(res1.tickets).toHaveLength(1);
    expect(res1.tickets[0].title).toBe("Implement visual query builder");

    // Search query 'protocol' matches epic 'Model Context Protocol Integration'
    const res2 = searchService.search(user1Id, "protocol");
    expect(res2.epics).toHaveLength(1);
    expect(res2.epics[0].title).toBe("Model Context Protocol Integration");

    // Search query 'kanban' matches project description 'Native macOS Kanban...'
    const res3 = searchService.search(user1Id, "kanban");
    expect(res3.projects).toHaveLength(1);
    expect(res3.projects[0].title).toBe("Desktop Application");

    // Search query 'mac' matches project and ticket descriptions
    const res4 = searchService.search(user1Id, "mac");
    expect(res4.total).toBeGreaterThan(0);
  });

  it("isolates search results across user accounts strictly", () => {
    const user2Res = searchService.search(user2Id, "query");
    expect(user2Res.total).toBe(0);
    expect(user2Res.tickets).toHaveLength(0);
    expect(user2Res.epics).toHaveLength(0);
    expect(user2Res.projects).toHaveLength(0);
  });
});
