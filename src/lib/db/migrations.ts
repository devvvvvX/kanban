import type { ISqlDatabase } from "./types";
import { getDb } from "./connection";
import { migration0001, type Migration } from "./migrations/0001_initial_auth";
import { migration0002 } from "./migrations/0002_projects_and_epics";
import { migration0003 } from "./migrations/0003_tickets_and_workflow_states";
import { migration0004 } from "./migrations/0004_subtasks_dependencies_comments_activity";
import { migration0005 } from "./migrations/0005_saved_queries_and_search_indexes";
import { migration0006 } from "./migrations/0006_mcp_sync_events";
import { migration0007 } from "./migrations/0007_workspaces";
import { migration0008 } from "./migrations/0008_mcp_settings";
import { migration0009 } from "./migrations/0009_attachments_and_notes";
import { migration0010 } from "./migrations/0010_todos";
import { migration0011 } from "./migrations/0011_todo_stars";
import { migration0012 } from "./migrations/0012_todo_steps_reminders";

export const allMigrations: Migration[] = [
  migration0001,
  migration0002,
  migration0003,
  migration0004,
  migration0005,
  migration0006,
  migration0007,
  migration0008,
  migration0009,
  migration0010,
  migration0011,
  migration0012,
];

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

/**
 * Ensures the schema_migrations tracking table exists.
 */
export function initMigrationTable(db: ISqlDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Returns all recorded migrations from the database.
 */
export function getAppliedMigrations(db: ISqlDatabase): MigrationRecord[] {
  initMigrationTable(db);
  const rows = db.prepare("SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC").all();
  return rows as MigrationRecord[];
}

/**
 * Runs all pending migrations in ascending order inside an atomic transaction.
 */
export function runMigrations(dbInstance?: ISqlDatabase): { applied: number; currentVersion: number } {
  const db = dbInstance ?? getDb();
  initMigrationTable(db);

  const appliedList = getAppliedMigrations(db);
  const appliedVersions = new Set(appliedList.map((m) => m.version));

  let appliedCount = 0;
  const sorted = [...allMigrations].sort((a, b) => a.version - b.version);

  for (const mig of sorted) {
    if (!appliedVersions.has(mig.version)) {
      const applyTxn = db.transaction(() => {
        mig.up(db);
        const stmt = db.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
        );
        stmt.run(mig.version, mig.name, new Date().toISOString());
      });
      applyTxn();
      appliedCount++;
    }
  }

  const latest = db.prepare("SELECT MAX(version) as maxVer FROM schema_migrations").get() as { maxVer: number | null };
  return {
    applied: appliedCount,
    currentVersion: latest?.maxVer ?? 0,
  };
}
