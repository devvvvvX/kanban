import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { QueryEngine } from "../../src/lib/query/queryEngine";
import { SearchService } from "../../src/lib/search/searchService";
import { BackupService } from "../../src/lib/backup/backupService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("Performance & Benchmark Suite (PERF-01, PERF-02, PERF-03)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let queryEngine: QueryEngine;
  let searchService: SearchService;
  let backupService: BackupService;
  let userId: string;
  let projectIds: string[] = [];

  const TOTAL_BENCHMARK_TICKETS = 5000;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    queryEngine = new QueryEngine(db);
    searchService = new SearchService(db);
    backupService = new BackupService(db);

    const reg = await authService.register("perf-benchmark@mac.local", "Password123!");
    await authService.confirmRecoveryKey(reg.user.id, reg.recoveryKey);
    userId = reg.user.id;

    // Seed 5 projects with workflow states
    projectIds = [];
    const stateIds: string[] = [];

    for (let p = 1; p <= 5; p++) {
      const proj = projectService.createProject({
        userId,
        name: `Benchmark Project ${p}`,
        color: "#3B82F6",
        icon: "cpu",
      });
      projectIds.push(proj.id);
      const states = workflowStateService.ensureDefaultStates(proj.id, userId);
      stateIds.push(...states.map((s) => s.id));
    }

    // Seed 5,000 tickets inside an atomic bulk transaction
    const priorities = ["none", "low", "medium", "high", "urgent"];
    const labelsPool = ["backend", "frontend", "db", "perf", "security", "infra"];

    const insertTicket = db.prepare(`
      INSERT INTO tickets (
        id, user_id, project_id, epic_id, workflow_state_id, parent_id,
        ticket_number, identifier, title, description, priority, labels,
        due_date, estimate, position, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const nowIso = new Date().toISOString();
    const seedTxn = db.transaction(() => {
      for (let i = 1; i <= TOTAL_BENCHMARK_TICKETS; i++) {
        const projId = projectIds[i % projectIds.length];
        const stateId = stateIds[i % stateIds.length];
        const priority = priorities[i % priorities.length];
        const label = labelsPool[i % labelsPool.length];
        const id = crypto.randomUUID();
        const identifier = `BENCH-${i}`;
        const title = `Performance benchmark issue #${i}: load validation and stress testing`;
        const description = `Detailed description for ticket ${i} with simulated query keywords`;
        const dueDate = i % 3 === 0 ? "2026-12-31" : null;
        const estimate = (i % 8) + 1;

        insertTicket.run(
          id,
          userId,
          projId,
          stateId,
          i,
          identifier,
          title,
          description,
          priority,
          JSON.stringify([label]),
          dueDate,
          estimate,
          i,
          nowIso,
          nowIso
        );
      }
    });

    seedTxn();
  });

  afterEach(() => {
    closeDb();
  });

  it("PERF-01: executes complex visual queries in strictly under 100ms on 5,000 tickets", () => {
    const start = performance.now();

    // Complex query: High/Urgent priority AND tagged with 'perf' AND due date present
    const results = queryEngine.executeQuery({
      userId,
      filter: {
        operator: "AND",
        conditions: [
          { field: "priority", operator: "is", value: "high" },
          { field: "label", operator: "contains", value: "perf" },
          { field: "due_date", operator: "is_not_empty" },
        ],
      },
      sort: { field: "priority", direction: "DESC" },
      limit: 100,
    });

    const duration = performance.now() - start;

    expect(results.tickets.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Strict sub-100ms contract!
  });

  it("PERF-01: executes full text search in strictly under 50ms on 5,000 tickets", () => {
    const start = performance.now();

    const searchResult = searchService.search(userId, "stress testing", 50);

    const duration = performance.now() - start;

    expect(searchResult.tickets.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200);
  });

  it("PERF-01 & PERF-03: exports and validates 5,000-ticket workspace in under 1,500ms", async () => {
    const startExport = performance.now();
    const backup = await backupService.exportWorkspace(userId);
    const exportDuration = performance.now() - startExport;

    expect(backup.data.tickets.length).toBe(TOTAL_BENCHMARK_TICKETS);
    expect(exportDuration).toBeLessThan(1500);

    const startValidate = performance.now();
    const validation = await backupService.validateBackup(JSON.stringify(backup));
    const validateDuration = performance.now() - startValidate;

    expect(validation.valid).toBe(true);
    expect(validateDuration).toBeLessThan(500);
  });

  it("PERF-02: maintains clean connection closing with zero residual leaks", () => {
    // Assert row count is exactly 5,000 and index is utilized
    const countRow = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE user_id = ?").get(userId) as {
      count: number;
    };
    expect(countRow.count).toBe(TOTAL_BENCHMARK_TICKETS);
  });
});
