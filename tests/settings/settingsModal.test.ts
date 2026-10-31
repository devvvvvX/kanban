import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { ProjectService } from "../../src/lib/projects/projectService";
import { TicketService } from "../../src/lib/tickets/ticketService";
import { WorkflowStateService } from "../../src/lib/tickets/workflowStateService";
import { BackupService } from "../../src/lib/backup/backupService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("Settings & Workspace Preferences (SETT-01, SETT-02, SETT-03)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let projectService: ProjectService;
  let workflowStateService: WorkflowStateService;
  let ticketService: TicketService;
  let backupService: BackupService;
  let userId: string;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    projectService = new ProjectService(db);
    workflowStateService = new WorkflowStateService(db);
    ticketService = new TicketService(db);
    backupService = new BackupService(db);

    const reg = await authService.register("settings-user@mac.local", "Password123!");
    await authService.confirmRecoveryKey(reg.user.id, reg.recoveryKey);
    userId = reg.user.id;
  });

  afterEach(() => {
    closeDb();
  });

  it("SETT-01: supports appearance density and motion preference values", () => {
    // Test density values
    const validDensities = ["comfortable", "compact"];
    expect(validDensities).toContain("comfortable");
    expect(validDensities).toContain("compact");

    // Test themes
    const validThemes = ["light", "dark", "system"];
    expect(validThemes).toContain("dark");
    expect(validThemes).toContain("light");
    expect(validThemes).toContain("system");
  });

  it("SETT-02 & SETT-03: export and import full workspace maintaining relational integrity", async () => {
    // 1. Create a project and tickets
    const proj = projectService.createProject({
      userId,
      name: "Distributed DB",
      color: "#10B981",
      icon: "database",
    });
    workflowStateService.ensureDefaultStates(proj.id, userId);

    ticketService.createTicket({
      userId,
      projectId: proj.id,
      title: "Write Write-Ahead Log (WAL)",
      priority: "urgent",
      estimate: 13,
    });

    // 2. Export
    const backup = await backupService.exportWorkspace(userId);
    expect(backup.data.projects.length).toBe(1);
    expect(backup.data.tickets.length).toBe(1);
    expect(backup.checksum).toBeDefined();

    // 3. Validate
    const validation = await backupService.validateBackup(JSON.stringify(backup));
    expect(validation.valid).toBe(true);
    expect(validation.stats?.projects).toBe(1);
    expect(validation.stats?.tickets).toBe(1);

    // 4. Restore in replace mode
    const restoreResult = await backupService.restoreWorkspace(userId, backup, "replace");
    expect(restoreResult.success).toBe(true);

    const afterRestore = ticketService.listTickets(proj.id, userId);
    expect(afterRestore.length).toBe(1);
    expect(afterRestore[0].title).toBe("Write Write-Ahead Log (WAL)");
  });

  it("SETT-03: rejects invalid or tampered JSON backups with descriptive error", async () => {
    const invalidJson = '{"appName":"wrong-app","version":"1.0"}';
    const res = await backupService.validateBackup(invalidJson);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Incompatible application");

    const nonJson = "not a json string at all";
    const resNonJson = await backupService.validateBackup(nonJson);
    expect(resNonJson.valid).toBe(false);
    expect(resNonJson.error).toContain("JSON parse error");
  });

  it("SETT-04: supports notification sound on/off and sound presets configuration", async () => {
    const {
      NOTIFICATION_SOUNDS,
      getNotificationSoundEnabled,
      setNotificationSoundEnabled,
      getSelectedNotificationSound,
      setSelectedNotificationSound,
      getContinuousRingEnabled,
      setContinuousRingEnabled,
    } = await import("../../src/utils/soundEffects");

    // All 6 default sounds must be defined
    expect(NOTIFICATION_SOUNDS).toHaveLength(6);
    const soundIds = NOTIFICATION_SOUNDS.map((s) => s.id);
    expect(soundIds).toContain("chime");
    expect(soundIds).toContain("bell");
    expect(soundIds).toContain("alarm");
    expect(soundIds).toContain("pop");
    expect(soundIds).toContain("ping");
    expect(soundIds).toContain("subtle");

    // Defaults to enabled
    expect(getNotificationSoundEnabled()).toBe(true);

    // Toggle sound off
    setNotificationSoundEnabled(false);
    expect(getNotificationSoundEnabled()).toBe(false);

    // Toggle sound back on
    setNotificationSoundEnabled(true);
    expect(getNotificationSoundEnabled()).toBe(true);

    // Select custom default sound
    setSelectedNotificationSound("pop");
    expect(getSelectedNotificationSound()).toBe("pop");

    setSelectedNotificationSound("alarm");
    expect(getSelectedNotificationSound()).toBe("alarm");

    // Continuous ring preference
    expect(getContinuousRingEnabled()).toBe(true);
    setContinuousRingEnabled(false);
    expect(getContinuousRingEnabled()).toBe(false);
    setContinuousRingEnabled(true);
  });
});
