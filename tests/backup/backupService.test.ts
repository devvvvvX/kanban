import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { BackupService, calculateChecksum } from "../../src/lib/backup/backupService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("BackupService (SETT-02, SETT-03)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let backupService: BackupService;
  let user1Id: string;
  let user2Id: string;
  let proj1Id: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    backupService = new BackupService(db);

    const u1 = await authService.register("backup-user1@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);
    user1Id = u1.user.id;

    const u2 = await authService.register("backup-user2@mac.local", "Password123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);
    user2Id = u2.user.id;

    // Create a project and tickets for User 1
    const p1 = projectService.createProject({
      userId: user1Id,
      name: "Core Infrastructure",
      description: "Low-level distributed services",
      color: "#3B82F6",
      icon: "cpu",
    });
    proj1Id = p1.id;
    workflowStateService.ensureDefaultStates(proj1Id, user1Id);

    ticketService.createTicket({
      userId: user1Id,
      projectId: proj1Id,
      title: "Design Raft Consensus",
      priority: "high",
      labels: ["backend", "distributed"],
      estimate: 8,
    });
  });

  afterEach(() => {
    closeDb();
  });

  it("exports workspace to versioned JSON with valid SHA-256 checksum (SETT-02)", async () => {
    const backup = await backupService.exportWorkspace(user1Id);

    expect(backup.version).toBe("1.0");
    expect(backup.appName).toBe("macos-kanban");
    expect(backup.checksum).toBeDefined();
    expect(backup.data.projects.length).toBe(1);
    expect(backup.data.projects[0].name).toBe("Core Infrastructure");
    expect(backup.data.workflowStates.length).toBe(4);
    expect(backup.data.tickets.length).toBe(1);
    expect(backup.data.tickets[0].title).toBe("Design Raft Consensus");

    // Verify checksum matches data
    const expectedChecksum = await calculateChecksum(JSON.stringify(backup.data));
    expect(backup.checksum).toBe(expectedChecksum);
  });

  it("validates valid backup file and reports correct stats", async () => {
    const backup = await backupService.exportWorkspace(user1Id);
    const jsonStr = JSON.stringify(backup);

    const validation = await backupService.validateBackup(jsonStr);
    expect(validation.valid).toBe(true);
    expect(validation.stats?.projects).toBe(1);
    expect(validation.stats?.tickets).toBe(1);
    expect(validation.stats?.workflowStates).toBe(4);
  });

  it("rejects tampered or corrupted backup files with checksum mismatch (SETT-03)", async () => {
    const backup = await backupService.exportWorkspace(user1Id);
    // Tamper with ticket title without updating checksum
    backup.data.tickets[0].title = "Tampered Ticket Title";
    const tamperedJson = JSON.stringify(backup);

    const validation = await backupService.validateBackup(tamperedJson);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Integrity check failed: checksum mismatch");
  });

  it("restores workspace in replace mode purging old data and re-binding to target user", async () => {
    const backup = await backupService.exportWorkspace(user1Id);

    // Create a new project for user 2
    const u2Project = projectService.createProject({
      userId: user2Id,
      name: "Old User 2 Project",
    });

    // User 2 restores User 1's backup in replace mode
    const res = await backupService.restoreWorkspace(user2Id, backup, "replace");
    expect(res.success).toBe(true);
    expect(res.mode).toBe("replace");

    // Old project of user 2 must be deleted
    const oldProj = projectService.getProject(u2Project.id, user2Id);
    expect(oldProj).toBeNull();

    // Restored project must belong to user 2
    const u2Projects = projectService.listProjects(user2Id);
    expect(u2Projects.length).toBe(1);
    expect(u2Projects[0].name).toBe("Core Infrastructure");
    expect(u2Projects[0].user_id).toBe(user2Id);

    // Restored ticket must belong to user 2
    const u2Tickets = ticketService.listTickets(u2Projects[0].id, user2Id);
    expect(u2Tickets.length).toBe(1);
    expect(u2Tickets[0].title).toBe("Design Raft Consensus");
    expect(u2Tickets[0].user_id).toBe(user2Id);
  });

  it("restores workspace in merge mode keeping existing projects", async () => {
    const backup = await backupService.exportWorkspace(user1Id);

    // User 2 already has a project
    projectService.createProject({
      userId: user2Id,
      name: "User 2 Project",
    });

    // Restore in merge mode
    await backupService.restoreWorkspace(user2Id, backup, "merge");

    const u2Projects = projectService.listProjects(user2Id);
    expect(u2Projects.length).toBe(2);
    const names = u2Projects.map((p) => p.name);
    expect(names).toContain("User 2 Project");
    expect(names).toContain("Core Infrastructure");
  });
});
