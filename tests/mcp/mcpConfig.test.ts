import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { SessionService } from "../../src/lib/auth/sessionService";
import { McpConfigService } from "../../src/lib/mcp/mcpConfigService";
import { McpServer } from "../../src/lib/mcp/server";
import { MCP_ERROR_CODES } from "../../src/lib/mcp/types";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("McpConfigService & Master On/Off Toggle", () => {
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
    const u1 = await authService.register("mcp-toggle1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;
    const session1 = sessionService.createSession(user1Id, 30, true);
    user1Token = session1.token;

    // Register User 2
    const u2 = await authService.register("mcp-toggle2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;
    const session2 = sessionService.createSession(user2Id, 30, true);
    user2Token = session2.token;
  });

  afterEach(() => {
    closeDb();
  });

  it("defaults to enabled when no config row exists", () => {
    const configService = new McpConfigService(db);
    expect(configService.isMcpEnabled(user1Id)).toBe(true);
    expect(configService.isMcpEnabled(user2Id)).toBe(true);
  });

  it("persists enabled/disabled status in SQLite database", () => {
    const configService = new McpConfigService(db);

    configService.setMcpEnabled(user1Id, false);
    expect(configService.isMcpEnabled(user1Id)).toBe(false);

    // User 2 remains enabled (multi-account isolation)
    expect(configService.isMcpEnabled(user2Id)).toBe(true);

    // Re-enable
    configService.setMcpEnabled(user1Id, true);
    expect(configService.isMcpEnabled(user1Id)).toBe(true);
  });

  it("rejects tool calls when MCP is disabled for the authenticated account", async () => {
    const server = new McpServer({ db, authToken: user1Token });
    const configService = new McpConfigService(db);

    // 1. Initial tool call when enabled succeeds
    const call1 = await server.processMessage({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });

    expect(call1).toBeDefined();
    expect(call1?.error).toBeUndefined();
    expect(call1?.result).toBeDefined();

    // 2. Disable MCP for User 1
    configService.setMcpEnabled(user1Id, false);

    const call2 = await server.processMessage({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });

    expect(call2).toBeDefined();
    expect(call2?.error).toBeDefined();
    expect(call2?.error?.code).toBe(MCP_ERROR_CODES.UNAUTHORIZED);
    expect(call2?.error?.message).toContain("MCP agent access is disabled");

    // Verify User 2 tool calls continue to succeed (isolation)
    const server2 = new McpServer({ db, authToken: user2Token });
    const user2Call = await server2.processMessage({
      jsonrpc: "2.0",
      id: 201,
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });
    expect(user2Call?.error).toBeUndefined();

    // 3. Re-enable MCP for User 1
    configService.setMcpEnabled(user1Id, true);

    const call3 = await server.processMessage({
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });

    expect(call3?.error).toBeUndefined();
    expect(call3?.result).toBeDefined();
  });
});
