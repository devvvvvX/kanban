import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { SessionService } from "../../src/lib/auth/sessionService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { McpServer } from "../../src/lib/mcp/server";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("MCP Notes Tools (list_notes, create_note, get_note, update_note, delete_note, convert_note_to_ticket)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let sessionService: SessionService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let projectId: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    sessionService = new SessionService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);

    // Register User 1
    const u1 = await authService.register("notes-mcp-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;
    const session1 = sessionService.createSession(user1Id, 30, true);
    user1Token = session1.token;

    // Register User 2
    const u2 = await authService.register("notes-mcp-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;
    const session2 = sessionService.createSession(user2Id, 30, true);
    user2Token = session2.token;

    // Create a project for User 1
    const proj = projectService.createProject({
      userId: user1Id,
      name: "Engineering System",
      description: "Core architecture",
    });
    projectId = proj.id;
    workflowStateService.ensureDefaultStates(projectId, user1Id);
  });

  afterEach(() => {
    closeDb();
  });

  it("lists note tools in tools/list response", async () => {
    const server = new McpServer({ db, authToken: user1Token });
    const res = await server.processMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    expect(res?.result).toBeDefined();
    const toolNames = (res?.result as any).tools.map((t: any) => t.name);
    expect(toolNames).toContain("list_notes");
    expect(toolNames).toContain("get_note");
    expect(toolNames).toContain("create_note");
    expect(toolNames).toContain("update_note");
    expect(toolNames).toContain("delete_note");
    expect(toolNames).toContain("convert_note_to_ticket");
  });

  it("creates, reads, updates, converts, and deletes notes via MCP tools with strict user isolation", async () => {
    const server1 = new McpServer({ db, authToken: user1Token });
    const server2 = new McpServer({ db, authToken: user2Token });

    // 1. User 1 creates a note
    const createRes = await server1.processMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "create_note",
        arguments: {
          title: "Microservices Architecture Notes",
          content: "### System Boundaries\n- [ ] Cache layer\n- [x] SQLite WAL mode\n:::info\nOffline first\n:::",
          projectId,
          isPinned: true,
        },
      },
    });

    expect(createRes?.result).toBeDefined();
    const note = JSON.parse((createRes?.result as any).content[0].text);
    expect(note.title).toBe("Microservices Architecture Notes");
    expect(note.is_pinned).toBe(1);
    expect(note.user_id).toBe(user1Id);
    const noteId = note.id;

    // 2. User 2 cannot access User 1's note (isolation)
    const accessRes = await server2.processMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_note",
        arguments: { noteId },
      },
    });
    expect((accessRes?.result as any).isError).toBe(true);

    // 3. User 1 reads note details
    const getRes = await server1.processMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_note",
        arguments: { noteId },
      },
    });
    const fetched = JSON.parse((getRes?.result as any).content[0].text);
    expect(fetched.id).toBe(noteId);
    expect(fetched.title).toBe("Microservices Architecture Notes");

    // 4. User 1 updates note
    const updateRes = await server1.processMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "update_note",
        arguments: {
          noteId,
          title: "Microservices Architecture Spec v2",
          content: "Updated content",
        },
      },
    });
    const updated = JSON.parse((updateRes?.result as any).content[0].text);
    expect(updated.title).toBe("Microservices Architecture Spec v2");
    expect(updated.content).toBe("Updated content");

    // 5. User 1 converts note into a Kanban ticket
    const convertRes = await server1.processMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "convert_note_to_ticket",
        arguments: {
          noteId,
          projectId,
          priority: "high",
        },
      },
    });
    const ticket = JSON.parse((convertRes?.result as any).content[0].text);
    expect(ticket.title).toBe("Microservices Architecture Spec v2");
    expect(ticket.description).toBe("Updated content");
    expect(ticket.priority).toBe("high");
    expect(ticket.project_id).toBe(projectId);

    // 6. User 1 deletes note
    const delRes = await server1.processMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "delete_note",
        arguments: { noteId },
      },
    });
    const delData = JSON.parse((delRes?.result as any).content[0].text);
    expect(delData.success).toBe(true);

    // 7. List notes should now be empty for User 1
    const listRes = await server1.processMessage({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "list_notes",
        arguments: {},
      },
    });
    const notesList = JSON.parse((listRes?.result as any).content[0].text);
    expect(notesList).toHaveLength(0);
  });
});
