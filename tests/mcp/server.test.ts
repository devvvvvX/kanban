import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { SessionService } from "../../src/lib/auth/sessionService";
import { McpServer } from "../../src/lib/mcp/server";
import { MCP_ERROR_CODES } from "../../src/lib/mcp/types";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("McpServer (MCP-01, MCP-02, MCP-03, MCP-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let sessionService: SessionService;
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    sessionService = new SessionService(db);

    // Register User 1
    const u1 = await authService.register("mcp-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;
    const session1 = sessionService.createSession(user1Id, 30, true);
    user1Token = session1.token;

    // Register User 2
    const u2 = await authService.register("mcp-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;
    const session2 = sessionService.createSession(user2Id, 30, true);
    user2Token = session2.token;
  });

  afterEach(() => {
    closeDb();
  });

  it("MCP-01: handles initialize, notifications/initialized, and ping methods", async () => {
    const server = new McpServer({ db });

    // 1. Initialize
    const initRes = await server.processMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(initRes).toBeDefined();
    expect(initRes?.id).toBe(1);
    expect(initRes?.result?.serverInfo?.name).toBe("macos-kanban-mcp");
    expect(initRes?.result?.protocolVersion).toBe("2024-11-05");

    // 2. Notification initialized returns null (no JSON-RPC response)
    const notifRes = await server.processMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(notifRes).toBeNull();

    // 3. Ping
    const pingRes = await server.processMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "ping",
    });
    expect(pingRes).toBeDefined();
    expect(pingRes?.id).toBe(2);
    expect(pingRes?.result).toEqual({});
  });

  it("MCP-04: tools/list returns all 8 required tools with schema definitions", async () => {
    const server = new McpServer({ db });
    const listRes = await server.processMessage({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/list",
    });

    expect(listRes?.result?.tools).toBeDefined();
    const tools = listRes!.result.tools;
    expect(tools.length).toBe(14);

    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_projects");
    expect(toolNames).toContain("create_project");
    expect(toolNames).toContain("list_tickets");
    expect(toolNames).toContain("get_ticket");
    expect(toolNames).toContain("create_ticket");
    expect(toolNames).toContain("update_ticket");
    expect(toolNames).toContain("move_ticket");
    expect(toolNames).toContain("search");
  });

  it("MCP-03: rejects unauthorized tool execution without token or with invalid token", async () => {
    const server = new McpServer({ db });

    // Call without any token
    const resNoToken = await server.processMessage({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });

    expect(resNoToken?.error).toBeDefined();
    expect(resNoToken?.error?.code).toBe(MCP_ERROR_CODES.UNAUTHORIZED);
    expect(resNoToken?.error?.message).toContain("session token required");

    // Call with invalid token
    const resBadToken = await server.processMessage({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: {
        authToken: "fake-invalid-token",
        name: "list_projects",
        arguments: {},
      },
    });

    expect(resBadToken?.error).toBeDefined();
    expect(resBadToken?.error?.code).toBe(MCP_ERROR_CODES.UNAUTHORIZED);
  });

  it("MCP-04 & MCP-02: executes project and ticket tools under authenticated account isolation", async () => {
    const syncEvents: any[] = [];
    const server = new McpServer({
      db,
      authToken: user1Token,
      onSyncEvent: (evt) => syncEvents.push(evt),
    });

    // 1. Create Project for User 1
    const createProjRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "p1",
      method: "tools/call",
      params: {
        name: "create_project",
        arguments: {
          name: "Kernel Engine",
          description: "Core high performance engine",
          color: "#10B981",
          icon: "zap",
        },
      },
    });

    expect(createProjRes?.error).toBeUndefined();
    expect(createProjRes?.result?.content?.[0]?.text).toBeDefined();
    const createdProj = JSON.parse(createProjRes!.result.content[0].text);
    expect(createdProj.id).toBeDefined();
    expect(createdProj.name).toBe("Kernel Engine");
    expect(createdProj.user_id).toBe(user1Id);

    // Verify sync event recorded
    expect(syncEvents.length).toBeGreaterThanOrEqual(1);
    expect(syncEvents[0].eventType).toBe("project_created");

    // 2. List Projects for User 1
    const listProjRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "p2",
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });
    const projList = JSON.parse(listProjRes!.result.content[0].text);
    expect(projList.length).toBe(1);
    expect(projList[0].id).toBe(createdProj.id);

    // 3. Create Ticket under Kernel Engine
    const createTicketRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "t1",
      method: "tools/call",
      params: {
        name: "create_ticket",
        arguments: {
          projectId: createdProj.id,
          title: "Implement memory manager",
          description: "Low-overhead slab allocator",
          priority: "high",
          labels: ["backend", "kernel"],
          estimate: 5,
        },
      },
    });

    expect(createTicketRes?.error).toBeUndefined();
    const createdTicket = JSON.parse(createTicketRes!.result.content[0].text);
    expect(createdTicket.id).toBeDefined();
    expect(createdTicket.identifier).toMatch(/^[A-Z]+-\d+$/);
    expect(createdTicket.title).toBe("Implement memory manager");
    expect(createdTicket.priority).toBe("high");

    // 4. Get Ticket by human-readable identifier
    const getByIdentifierRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "t2",
      method: "tools/call",
      params: {
        name: "get_ticket",
        arguments: {
          idOrIdentifier: createdTicket.identifier,
        },
      },
    });
    const fetchedByIdentifier = JSON.parse(getByIdentifierRes!.result.content[0].text);
    expect(fetchedByIdentifier.id).toBe(createdTicket.id);
    expect(fetchedByIdentifier.workflow_state).toBeDefined();

    // 5. Update Ticket
    const updateTicketRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "t3",
      method: "tools/call",
      params: {
        name: "update_ticket",
        arguments: {
          ticketId: createdTicket.id,
          title: "Implement memory manager (v2)",
          priority: "urgent",
        },
      },
    });
    const updatedTicket = JSON.parse(updateTicketRes!.result.content[0].text);
    expect(updatedTicket.title).toBe("Implement memory manager (v2)");
    expect(updatedTicket.priority).toBe("urgent");

    // 6. Move Ticket to In Progress column
    // Fetch project's workflow states
    const states = db.prepare("SELECT id, name FROM workflow_states WHERE project_id = ?").all(createdProj.id) as any[];
    expect(states.length).toBeGreaterThan(1);
    const targetState = states[1];

    const moveTicketRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "t4",
      method: "tools/call",
      params: {
        name: "move_ticket",
        arguments: {
          ticketId: createdTicket.identifier, // Can move via identifier!
          targetStateId: targetState.id,
        },
      },
    });
    const movedTicket = JSON.parse(moveTicketRes!.result.content[0].text);
    expect(movedTicket.workflow_state_id).toBe(targetState.id);

    // 7. Search for tickets
    const searchRes = await server.processMessage({
      jsonrpc: "2.0",
      id: "s1",
      method: "tools/call",
      params: {
        name: "search",
        arguments: {
          query: "memory",
        },
      },
    });
    const searchResult = JSON.parse(searchRes!.result.content[0].text);
    expect(searchResult.tickets.length).toBe(1);
    expect(searchResult.tickets[0].id).toBe(createdTicket.id);

    // 8. Multi-account isolation: User 2 cannot access User 1's resources
    const serverUser2 = new McpServer({
      db,
      authToken: user2Token,
    });

    const user2ListProj = await serverUser2.processMessage({
      jsonrpc: "2.0",
      id: "u2-1",
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });
    const user2Projects = JSON.parse(user2ListProj!.result.content[0].text);
    expect(user2Projects.length).toBe(0); // Zero data leakage!

    const user2GetTicket = await serverUser2.processMessage({
      jsonrpc: "2.0",
      id: "u2-2",
      method: "tools/call",
      params: {
        name: "get_ticket",
        arguments: {
          idOrIdentifier: createdTicket.identifier,
        },
      },
    });
    expect(user2GetTicket?.result?.isError).toBe(true);
    expect(user2GetTicket?.result?.content[0]?.text).toContain("not found");
  });
});
