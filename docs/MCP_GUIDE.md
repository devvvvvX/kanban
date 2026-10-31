# Model Context Protocol (MCP) Integration Guide

> **Connect AI coding agents (Claude Desktop, Cursor, Antigravity, custom LLMs) directly to your local Kanban database.**

---

## What is MCP in Kanban?

Kanban implements the official **Model Context Protocol (MCP)** specification over standard input/output (stdio JSON-RPC 2.0).

This allows your local AI coding assistants to:
- **Inspect your backlog** before proposing code changes or sprint tasks.
- **Create implementation tickets** directly from chat or code reviews.
- **Update ticket status** (e.g. move `APP-14` to `In Progress` or `Done`) when completing work.
- **Search past issues & notes** for architectural context.
- **Reflect changes instantly** in the running desktop Kanban application.

All operations execute strictly within the authenticated local user's account with zero cloud leakage.

---

## 1. Quick Setup: Claude Desktop

### Step 1: Obtain Your Local Auth Token
1. Launch **Kanban**.
2. Open **Preferences** (<kbd>Cmd</kbd> + <kbd>,</kbd> or click the gear icon in the sidebar).
3. Navigate to the **MCP Agent** tab under *Integrations*.
4. Ensure MCP is toggled **Active**.
5. Click **Copy Token** to copy your unique local bearer token.

### Step 2: Configure Claude Desktop
Open your Claude Desktop configuration file:

```bash
# macOS default configuration path
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add the `macos-kanban` server entry:

#### Using the Installed macOS App Binary (Recommended):
```json
{
  "mcpServers": {
    "macos-kanban": {
      "command": "/Applications/Kanban.app/Contents/MacOS/kanban-mcp",
      "args": [],
      "env": {
        "KANBAN_AUTH_TOKEN": "<your-copied-auth-token>"
      }
    }
  }
}
```

#### Using Source / Node.js Runner:
```json
{
  "mcpServers": {
    "macos-kanban": {
      "command": "node",
      "args": ["/absolute/path/to/kanban/dist/mcp/cli.js"],
      "env": {
        "KANBAN_AUTH_TOKEN": "<your-copied-auth-token>"
      }
    }
  }
}
```

### Step 3: Restart Claude Desktop
Restart Claude Desktop. You will see the hammer icon (`🛠️`) in the prompt input indicating the Kanban tools are connected and available!

---

## 2. Cursor IDE Integration

1. In Cursor, open **Settings** (<kbd>Cmd</kbd> + <kbd>,</kbd>) $\rightarrow$ **Features** $\rightarrow$ **MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Fill in the details:
   - **Name**: `macos-kanban`
   - **Type**: `command`
   - **Command**: `/Applications/Kanban.app/Contents/MacOS/kanban-mcp`
4. Set the environment variable:
   - `KANBAN_AUTH_TOKEN`: `<your-copied-auth-token>`
5. Click **Save** and verify the green status indicator.

Alternatively, configure via `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "macos-kanban": {
      "command": "/Applications/Kanban.app/Contents/MacOS/kanban-mcp",
      "args": [],
      "env": {
        "KANBAN_AUTH_TOKEN": "<your-copied-auth-token>"
      }
    }
  }
}
```

---

## 3. Tool Reference

### `list_projects`
Returns all active, pinned, and archived projects.
```json
{}
```

### `get_project_summary`
Returns project health metrics, ticket counts by column, and completion %.
```json
{
  "projectId": "proj_1234"
}
```

### `list_tickets`
Queries tickets with optional status, priority, or project filters.
```json
{
  "projectId": "proj_1234",
  "status": "in_progress",
  "priority": "high",
  "limit": 20
}
```

### `get_ticket`
Retrieves full details for a ticket including subtasks, dependencies, and comments.
```json
{
  "ticketId": "APP-42"
}
```

### `create_ticket`
Creates a new relational ticket with an auto-assigned identifier.
```json
{
  "projectId": "proj_1234",
  "title": "Implement SQLite WAL checkpointing",
  "description": "Optimize WAL auto-checkpoint threshold to prevent db file bloat.",
  "priority": "high",
  "status": "todo"
}
```

### `update_ticket`
Modifies an existing ticket.
```json
{
  "ticketId": "APP-42",
  "fields": {
    "status": "done",
    "priority": "medium"
  }
}
```

### `delete_ticket`
Deletes a ticket and cascades removal of associated subtasks.
```json
{
  "ticketId": "APP-42"
}
```

### `search_tickets`
Full-text search across ticket titles and markdown bodies.
```json
{
  "query": "authentication recovery",
  "limit": 10
}
```

---

## 4. Troubleshooting & FAQ

### Agent reports "Authentication failed" or "Invalid token"
- Ensure `KANBAN_AUTH_TOKEN` is set in the client's `env` object.
- You can regenerate a fresh token at any time in **Preferences > MCP Agent > Regenerate Token**.

### "Node runtime not found" when using `kanban-mcp`
- The `kanban-mcp` launcher searches `/opt/homebrew/bin/node`, `/usr/local/bin/node`, and `~/.nvm/versions/node`.
- If Node is installed in a non-standard path, set `export PATH="/your/custom/node/bin:$PATH"` in `~/.kanban-env`.

### Real-time UI updates
- Desktop Kanban automatically listens for database modifications via internal polling. When your agent updates tickets via MCP, the desktop Kanban board updates within 1 second.

