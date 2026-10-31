#!/usr/bin/env node
/**
 * Standalone MCP Stdio Server CLI Entrypoint.
 * Executable by Claude Desktop, Cursor, or AI CLI agents.
 */
import { McpServer } from "./server";
import { initDb } from "../db/connection";
import { runMigrations } from "../db/migrations";

async function main() {
  const db = await initDb();
  runMigrations(db);

  const server = new McpServer({ db });
  server.startStdio();
}

main().catch((err) => {
  process.stderr.write(`[MCP Fatal] ${err.message}\n${err.stack}\n`);
  process.exit(1);
});

