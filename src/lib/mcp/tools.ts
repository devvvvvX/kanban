import type { ToolDefinition } from "./types";

export const MCP_TOOLS: ToolDefinition[] = [
  {
    name: "list_projects",
    description: "List all active and archived projects belonging to the authenticated account.",
    inputSchema: {
      type: "object",
      properties: {
        includeArchived: {
          type: "boolean",
          description: "Whether to include archived projects (default: false)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_project",
    description: "Create a new project workspace for tasks and epics.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Project title (1-100 characters)",
        },
        description: {
          type: "string",
          description: "Optional project description or goals in Markdown",
        },
        color: {
          type: "string",
          description: "Hex accent color code (e.g. #3B82F6, #10B981, #EC4899)",
        },
        icon: {
          type: "string",
          description: "Lucide icon name (e.g. folder, layout, zap, target, book)",
        },
        isPinned: {
          type: "boolean",
          description: "Whether project is pinned to the top of the sidebar",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "list_tickets",
    description: "List tickets for the user with optional filtering by project, workflow state, priority, or epic.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Filter tickets by project ID",
        },
        workflowStateId: {
          type: "string",
          description: "Filter tickets by workflow column state ID",
        },
        priority: {
          type: "string",
          enum: ["none", "low", "medium", "high", "urgent"],
          description: "Filter tickets by priority level",
        },
        epicId: {
          type: "string",
          description: "Filter tickets by parent epic ID",
        },
        includeArchived: {
          type: "boolean",
          description: "Whether to include archived tickets (default: false)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_ticket",
    description: "Retrieve complete ticket details by either UUID or human-readable identifier (e.g. 'KAN-1', 'PROJ-42').",
    inputSchema: {
      type: "object",
      properties: {
        idOrIdentifier: {
          type: "string",
          description: "The ticket UUID or human-readable identifier (e.g. 'KAN-1')",
        },
        projectId: {
          type: "string",
          description: "Optional project ID if searching by identifier across projects",
        },
      },
      required: ["idOrIdentifier"],
      additionalProperties: false,
    },
  },
  {
    name: "create_ticket",
    description: "Create a new ticket under a project with optional markdown description, priority, tags, estimate, and due date.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "ID of the project to add this ticket to",
        },
        title: {
          type: "string",
          description: "Ticket title (1-200 characters)",
        },
        description: {
          type: "string",
          description: "Detailed description in Markdown format",
        },
        priority: {
          type: "string",
          enum: ["none", "low", "medium", "high", "urgent"],
          description: "Ticket priority level (default: 'none')",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "List of tag labels (e.g. ['frontend', 'bug', 'mcp'])",
        },
        estimate: {
          type: "number",
          description: "Story points or estimate value (positive number)",
        },
        dueDate: {
          type: "string",
          description: "Due date in YYYY-MM-DD or ISO 8601 format",
        },
        epicId: {
          type: "string",
          description: "Optional parent epic ID to associate with this ticket",
        },
        workflowStateId: {
          type: "string",
          description: "Initial column workflow state ID (defaults to project's first column)",
        },
      },
      required: ["projectId", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_ticket",
    description: "Update fields of an existing ticket (title, description, priority, labels, estimate, due date, epic).",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "UUID or identifier of the ticket to update",
        },
        title: {
          type: "string",
          description: "New title",
        },
        description: {
          type: "string",
          description: "New Markdown description (or empty string to clear)",
        },
        priority: {
          type: "string",
          enum: ["none", "low", "medium", "high", "urgent"],
          description: "New priority level",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Updated list of tags/labels",
        },
        estimate: {
          type: "number",
          description: "Updated estimate points",
        },
        dueDate: {
          type: ["string", "null"],
          description: "Updated due date in YYYY-MM-DD format (or null to clear)",
        },
        epicId: {
          type: ["string", "null"],
          description: "Updated epic ID (or null to detach)",
        },
        workflowStateId: {
          type: "string",
          description: "Destination workflow state ID",
        },
      },
      required: ["ticketId"],
      additionalProperties: false,
    },
  },
  {
    name: "move_ticket",
    description: "Move a ticket to a target workflow state (column) and optionally set its position.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "UUID or identifier of the ticket to move",
        },
        targetStateId: {
          type: "string",
          description: "Destination workflow state ID (column)",
        },
        position: {
          type: "number",
          description: "Optional 0-indexed position within the column",
        },
      },
      required: ["ticketId", "targetStateId"],
      additionalProperties: false,
    },
  },
  {
    name: "search",
    description: "Search across tickets, epics, and projects with sub-100ms indexed lookups.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search text query or identifier prefix (e.g. 'auth', 'KAN-1', 'oauth')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 20)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_notes",
    description: "List all notes or scratchpad documents belonging to the authenticated account.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Optional project ID to filter notes by",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_note",
    description: "Retrieve full details and content of a specific note by ID.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "UUID of the note to retrieve",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_note",
    description: "Create a new note or scratchpad entry with Markdown formatting, callout boxes, and whiteboard data.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Note title",
        },
        content: {
          type: "string",
          description: "Note content in Markdown (supports headers, callout boxes, checklists, and images)",
        },
        projectId: {
          type: "string",
          description: "Optional project ID to associate note with",
        },
        color: {
          type: "string",
          description: "Optional hex accent color (e.g. #3B82F6, #10B981, #EC4899)",
        },
        isPinned: {
          type: "boolean",
          description: "Whether the note is pinned to the top of the notepad list",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_note",
    description: "Update the title, content, or pinned state of an existing note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "UUID of the note to update",
        },
        title: {
          type: "string",
          description: "Updated title",
        },
        content: {
          type: "string",
          description: "Updated content in Markdown",
        },
        projectId: {
          type: ["string", "null"],
          description: "Updated project ID or null to unlink",
        },
        color: {
          type: "string",
          description: "Updated accent color",
        },
        isPinned: {
          type: "boolean",
          description: "Whether the note is pinned",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_note",
    description: "Delete a note by ID.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "UUID of the note to delete",
        },
      },
      required: ["noteId"],
      additionalProperties: false,
    },
  },
  {
    name: "convert_note_to_ticket",
    description: "Convert a note into a Kanban ticket in a target project.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "UUID of the note to convert",
        },
        projectId: {
          type: "string",
          description: "UUID of the target project to create the ticket in",
        },
        workflowStateId: {
          type: "string",
          description: "Optional workflow state / column ID (defaults to unstarted / backlog)",
        },
        priority: {
          type: "string",
          enum: ["none", "low", "medium", "high", "urgent"],
          description: "Ticket priority level (default: none)",
        },
        customTitle: {
          type: "string",
          description: "Optional custom ticket title (defaults to note title)",
        },
      },
      required: ["noteId", "projectId"],
      additionalProperties: false,
    },
  },
];

