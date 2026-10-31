import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import { SessionService } from "../auth/sessionService";
import { ProjectService } from "../projects/projectService";
import { TicketService } from "../tickets/ticketService";
import { WorkflowStateService } from "../tickets/workflowStateService";
import { SearchService } from "../search/searchService";
import { NoteService } from "../notes/noteService";
import { MCP_TOOLS } from "./tools";
import { syncBroadcaster, type SyncEvent } from "./syncBroadcast";
import { McpConfigService } from "./mcpConfigService";
import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpInitializeResult,
  type McpToolCallResult,
  MCP_ERROR_CODES,
} from "./types";

export interface McpServerOptions {
  db?: ISqlDatabase;
  authToken?: string;
  onSyncEvent?: (event: {
    eventType: string;
    entityType: string;
    entityId: string;
    payload: any;
  }) => void;
}

export class McpServer {
  private db: ISqlDatabase;
  private sessionToken: string | null = null;
  private sessionService: SessionService;
  private projectService: ProjectService;
  private ticketService: TicketService;
  private workflowStateService: WorkflowStateService;
  private searchService: SearchService;
  private noteService: NoteService;
  private onSyncEvent?: McpServerOptions["onSyncEvent"];

  constructor(options?: McpServerOptions) {
    this.db = options?.db ?? getDb();
    this.sessionService = new SessionService(this.db);
    this.projectService = new ProjectService(this.db);
    this.workflowStateService = new WorkflowStateService(this.db);
    this.ticketService = new TicketService(this.db);
    this.searchService = new SearchService(this.db);
    this.noteService = new NoteService(this.db);
    this.onSyncEvent = options?.onSyncEvent;

    if (options?.authToken) {
      this.sessionToken = options.authToken;
    } else if (typeof process !== "undefined" && process.env?.KANBAN_AUTH_TOKEN) {
      this.sessionToken = process.env.KANBAN_AUTH_TOKEN;
    } else if (typeof process !== "undefined" && typeof require !== "undefined") {
      try {
        const fs = require("fs");
        const path = require("path");
        const candidates = [
          path.join(process.env.HOME || "", ".kanban-env"),
          path.join(process.env.HOME || "", "kanban-env"),
          path.join(process.env.HOME || "", ".env"),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            const content = fs.readFileSync(candidate, "utf-8");
            const match = content.match(/^KANBAN_AUTH_TOKEN=(.*)$/m);
            if (match) {
              this.sessionToken = match[1].trim().replace(/^['"]|['"]$/g, "");
              break;
            }
          }
        }
      } catch {
        // Ignore if file read fails
      }
    }
  }

  /**
   * Set or update the active authentication token.
   */
  setAuthToken(token: string | null): void {
    this.sessionToken = token;
  }

  /**
   * Resolves the authenticated user ID for the current request.
   */
  private getAuthenticatedUserId(req?: JsonRpcRequest): string | null {
    // 1. Check request level auth token
    const reqToken =
      req?.params?.authToken ||
      req?.params?._authToken ||
      (req?.params?.arguments && req.params.arguments._authToken) ||
      this.sessionToken;

    if (!reqToken || typeof reqToken !== "string") {
      return null;
    }

    const validation = this.sessionService.validateSession(reqToken);
    if (!validation.valid || !validation.user) {
      return null;
    }

    return validation.user.id;
  }

  /**
   * Records a sync event in the SQLite database and triggers any in-process listeners.
   */
  private recordSyncEvent(
    userId: string,
    eventType: string,
    entityType: string,
    entityId: string,
    payload: any
  ): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const evt: SyncEvent = {
      id,
      userId,
      eventType,
      entityType,
      entityId,
      payload,
      createdAt: now,
    };

    syncBroadcaster.broadcast(evt, this.db);

    if (this.onSyncEvent) {
      this.onSyncEvent({ eventType, entityType, entityId, payload });
    }
  }

  /**
   * Resolves a ticket ID from either a UUID or a human-readable identifier (e.g. 'KAN-1').
   */
  private resolveTicketId(idOrIdentifier: string, userId: string, projectId?: string): string | null {
    if (!idOrIdentifier) return null;

    // Check if directly a valid ticket ID
    const direct = this.ticketService.getTicket(idOrIdentifier, userId);
    if (direct) return direct.id;

    // Check by identifier
    let query = "SELECT id FROM tickets WHERE identifier = ? AND user_id = ?";
    const params: any[] = [idOrIdentifier, userId];
    if (projectId) {
      query += " AND project_id = ?";
      params.push(projectId);
    }

    const row = this.db.prepare(query).get(...params) as { id: string } | undefined;
    return row ? row.id : null;
  }

  /**
   * Process a single JSON-RPC 2.0 message.
   * Returns a response object, or null for notifications.
   */
  async processMessage(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    if (!req || typeof req !== "object") {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: MCP_ERROR_CODES.INVALID_REQUEST, message: "Invalid JSON-RPC request" },
      };
    }

    const { id, method, params } = req;
    const isNotification = id === undefined || id === null;
    const responseId = id ?? null;

    // Check protocol version
    if (req.jsonrpc !== "2.0" || typeof method !== "string") {
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id: responseId,
        error: { code: MCP_ERROR_CODES.INVALID_REQUEST, message: "Invalid Request: jsonrpc must be '2.0'" },
      };
    }

    // Handle notifications
    if (method === "notifications/initialized") {
      return null;
    }

    // Standard MCP handlers
    switch (method) {
      case "initialize": {
        // Capture auth token if passed in initializationOptions
        if (params?.initializationOptions?.authToken) {
          this.sessionToken = params.initializationOptions.authToken;
        } else if (params?.authToken) {
          this.sessionToken = params.authToken;
        }

        const result: McpInitializeResult = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: "macos-kanban-mcp",
            version: "1.0.1",
          },
        };
        return { jsonrpc: "2.0", id: responseId, result };
      }

      case "ping": {
        return { jsonrpc: "2.0", id: responseId, result: {} };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id: responseId,
          result: {
            tools: MCP_TOOLS,
          },
        };
      }

      case "tools/call": {
        const userId = this.getAuthenticatedUserId(req);
        if (!userId) {
          return {
            jsonrpc: "2.0",
            id: responseId,
            error: {
              code: MCP_ERROR_CODES.UNAUTHORIZED,
              message: "Unauthorized: valid session token required for tool execution",
            },
          };
        }

        const configService = new McpConfigService(this.db);
        if (!configService.isMcpEnabled(userId)) {
          return {
            jsonrpc: "2.0",
            id: responseId,
            error: {
              code: MCP_ERROR_CODES.UNAUTHORIZED,
              message: "MCP agent access is disabled in Kanban settings for this account. Please enable it in Settings to allow tool execution.",
            },
          };
        }

        const toolName = params?.name as string | undefined;
        const toolArgs = (params?.arguments || {}) as Record<string, any>;

        if (!toolName || typeof toolName !== "string") {
          return {
            jsonrpc: "2.0",
            id: responseId,
            error: {
              code: MCP_ERROR_CODES.INVALID_PARAMS,
              message: "Missing or invalid tool 'name' parameter",
            },
          };
        }

        try {
          const result = await this.executeTool(toolName, toolArgs, userId);
          return { jsonrpc: "2.0", id: responseId, result };
        } catch (err: any) {
          return {
            jsonrpc: "2.0",
            id: responseId,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Tool execution failed: ${err.message || String(err)}`,
                },
              ],
            } as McpToolCallResult,
          };
        }
      }

      default: {
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id: responseId,
          error: {
            code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          },
        };
      }
    }
  }

  /**
   * Executes an authenticated MCP tool.
   */
  private async executeTool(
    name: string,
    args: Record<string, any>,
    userId: string
  ): Promise<McpToolCallResult> {
    switch (name) {
      case "list_projects": {
        const includeArchived = Boolean(args.includeArchived);
        const projects = this.projectService.listProjects(userId, { includeArchived });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      case "create_project": {
        if (!args.name || typeof args.name !== "string" || !args.name.trim()) {
          throw new Error("Project name is required and cannot be empty");
        }
        const created = this.projectService.createProject({
          userId,
          name: args.name.trim(),
          description: args.description,
          color: args.color,
          icon: args.icon,
          isPinned: args.isPinned,
        });

        // Ensure default workflow columns (Backlog, Todo, In Progress, Done)
        this.workflowStateService.ensureDefaultStates(created.id, userId);

        this.recordSyncEvent(userId, "project_created", "project", created.id, created);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(created, null, 2),
            },
          ],
        };
      }

      case "list_tickets": {
        let tickets;
        if (args.projectId) {
          tickets = this.ticketService.listTickets(args.projectId, userId, {
            workflowStateId: args.workflowStateId,
            priority: args.priority,
            epicId: args.epicId,
            includeArchived: args.includeArchived,
          });
        } else {
          // Query across all projects for this user
          let sql = "SELECT * FROM tickets WHERE user_id = ?";
          const params: any[] = [userId];

          if (!args.includeArchived) {
            sql += " AND is_archived = 0";
          }
          if (args.workflowStateId) {
            sql += " AND workflow_state_id = ?";
            params.push(args.workflowStateId);
          }
          if (args.priority) {
            sql += " AND priority = ?";
            params.push(args.priority);
          }
          if (args.epicId) {
            sql += " AND epic_id = ?";
            params.push(args.epicId);
          }
          sql += " ORDER BY updated_at DESC LIMIT 100";

          const rows = this.db.prepare(sql).all(...params) as any[];
          tickets = rows.map((r) => {
            let labels: string[] = [];
            try {
              labels = JSON.parse(r.labels || "[]");
            } catch {
              labels = [];
            }
            return { ...r, labels };
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tickets, null, 2),
            },
          ],
        };
      }

      case "get_ticket": {
        const idOrIdentifier = args.idOrIdentifier;
        if (!idOrIdentifier) {
          throw new Error("Missing required argument: idOrIdentifier");
        }

        const ticketId = this.resolveTicketId(idOrIdentifier, userId, args.projectId);
        if (!ticketId) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Ticket '${idOrIdentifier}' not found or access denied.`,
              },
            ],
          };
        }

        const ticket = this.ticketService.getTicket(ticketId, userId);
        if (!ticket) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Ticket '${idOrIdentifier}' not found or access denied.`,
              },
            ],
          };
        }

        // Include workflow state information
        const state = this.workflowStateService.getState(ticket.workflow_state_id, userId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...ticket,
                  workflow_state: state ? { id: state.id, name: state.name, category: state.category } : null,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_ticket": {
        if (!args.projectId) throw new Error("projectId is required to create a ticket");
        if (!args.title || !args.title.trim()) throw new Error("title is required to create a ticket");

        const created = this.ticketService.createTicket({
          userId,
          projectId: args.projectId,
          title: args.title.trim(),
          description: args.description,
          priority: args.priority || "none",
          labels: args.labels || [],
          estimate: args.estimate,
          dueDate: args.dueDate,
          epicId: args.epicId,
          workflowStateId: args.workflowStateId,
        });

        this.recordSyncEvent(userId, "ticket_created", "ticket", created.id, created);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(created, null, 2),
            },
          ],
        };
      }

      case "update_ticket": {
        const ticketId = this.resolveTicketId(args.ticketId, userId);
        if (!ticketId) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Ticket '${args.ticketId}' not found or access denied.`,
              },
            ],
          };
        }

        const updated = this.ticketService.updateTicket(ticketId, userId, {
          title: args.title,
          description: args.description,
          priority: args.priority,
          labels: args.labels,
          estimate: args.estimate,
          dueDate: args.dueDate,
          epicId: args.epicId,
          workflowStateId: args.workflowStateId,
        });

        this.recordSyncEvent(userId, "ticket_updated", "ticket", updated.id, updated);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      }

      case "move_ticket": {
        const ticketId = this.resolveTicketId(args.ticketId, userId);
        if (!ticketId) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Ticket '${args.ticketId}' not found or access denied.`,
              },
            ],
          };
        }

        if (!args.targetStateId) {
          throw new Error("targetStateId is required to move a ticket");
        }

        const moved = this.ticketService.moveTicket(ticketId, userId, args.targetStateId, args.position);

        this.recordSyncEvent(userId, "ticket_moved", "ticket", moved.id, moved);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(moved, null, 2),
            },
          ],
        };
      }

      case "search": {
        const query = args.query;
        if (!query || typeof query !== "string") {
          throw new Error("query string is required for search");
        }

        const limit = args.limit ? Number(args.limit) : 20;
        const result = this.searchService.search(userId, query, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_notes": {
        const notes = this.noteService.listNotes(userId, args.projectId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(notes, null, 2),
            },
          ],
        };
      }

      case "get_note": {
        if (!args.noteId) throw new Error("noteId is required");
        const note = this.noteService.getNote(args.noteId, userId);
        if (!note) throw new Error(`Note not found: ${args.noteId}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(note, null, 2),
            },
          ],
        };
      }

      case "create_note": {
        if (!args.title || typeof args.title !== "string" || !args.title.trim()) {
          throw new Error("title is required");
        }
        const created = this.noteService.createNote(
          {
            title: args.title.trim(),
            content: args.content,
            projectId: args.projectId,
            color: args.color,
            isPinned: args.isPinned,
          },
          userId
        );
        this.recordSyncEvent(userId, "note_created", "note", created.id, created);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(created, null, 2),
            },
          ],
        };
      }

      case "update_note": {
        if (!args.noteId) throw new Error("noteId is required");
        const updated = this.noteService.updateNote(
          args.noteId,
          {
            title: args.title,
            content: args.content,
            projectId: args.projectId,
            color: args.color,
            isPinned: args.isPinned,
          },
          userId
        );
        this.recordSyncEvent(userId, "note_updated", "note", updated.id, updated);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      }

      case "delete_note": {
        if (!args.noteId) throw new Error("noteId is required");
        const deleted = this.noteService.deleteNote(args.noteId, userId);
        this.recordSyncEvent(userId, "note_deleted", "note", args.noteId, { id: args.noteId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: deleted, noteId: args.noteId }, null, 2),
            },
          ],
        };
      }

      case "convert_note_to_ticket": {
        if (!args.noteId) throw new Error("noteId is required");
        if (!args.projectId) throw new Error("projectId is required");
        const ticket = this.noteService.convertNoteToTicket(
          {
            noteId: args.noteId,
            projectId: args.projectId,
            workflowStateId: args.workflowStateId,
            priority: args.priority,
            customTitle: args.customTitle,
          },
          userId
        );
        this.recordSyncEvent(userId, "ticket_created", "ticket", ticket.id, ticket);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(ticket, null, 2),
            },
          ],
        };
      }

      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  }

  /**
   * Starts processing stdio stream for MCP clients.
   * Standard error is strictly used for logging so stdout remains pure JSON-RPC.
   */
  startStdio(
    stdin: NodeJS.ReadableStream = process.stdin,
    stdout: NodeJS.WritableStream = process.stdout,
    stderr: NodeJS.WritableStream = process.stderr
  ): void {
    let buffer = "";

    stdin.setEncoding?.("utf-8");
    stdin.on("data", async (chunk: string | Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      // Keep incomplete trailing line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const req = JSON.parse(trimmed) as JsonRpcRequest;
          const res = await this.processMessage(req);
          if (res) {
            stdout.write(JSON.stringify(res) + "\n");
          }
        } catch (err: any) {
          stderr.write(`[MCP Error] Failed to parse JSON-RPC line: ${err.message}\n`);
          const parseError: JsonRpcResponse = {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: MCP_ERROR_CODES.PARSE_ERROR,
              message: "Parse error: invalid JSON",
            },
          };
          stdout.write(JSON.stringify(parseError) + "\n");
        }
      }
    });

    stdin.on("end", () => {
      stderr.write("[MCP Info] Stdio stream closed\n");
    });
  }
}
