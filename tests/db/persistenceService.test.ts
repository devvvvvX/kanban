import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb, isValidSqliteDatabase } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { DatabasePersistenceService } from "../../src/lib/db/persistenceService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("DatabasePersistenceService", () => {
  let db: ISqlDatabase;
  let persistenceService: DatabasePersistenceService;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    persistenceService = new DatabasePersistenceService();
  });

  afterEach(() => {
    closeDb();
  });

  it("retrieves storage metadata with active size and path", async () => {
    const info = await persistenceService.getStorageInfo();
    expect(info).toBeDefined();
    expect(info.sizeBytes).toBeGreaterThan(0);
    expect(info.databasePath).toBeDefined();
    expect(info.storageType).toBeDefined();
    expect(info.lastUpdated).toBeDefined();
  });

  it("exports active database as a valid raw SQLite 3 binary payload", () => {
    const bytes = persistenceService.exportSqliteDatabase();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(isValidSqliteDatabase(bytes)).toBe(true);
  });

  it("rejects importing invalid non-SQLite files", async () => {
    const fakeHtml = new TextEncoder().encode("<!doctype html><html><body>Error</body></html>");
    await expect(persistenceService.importSqliteDatabase(fakeHtml)).rejects.toThrow(
      /Invalid SQLite database file/
    );
  });

  it("imports a valid SQLite database snapshot, reapplies migrations, and refreshes queries", async () => {
    // Add a marker user in active database
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "imported-user-1",
      "snapshot@mac.local",
      "argon2id_mock_hash",
      "Snapshot User",
      "active",
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Export valid snapshot
    const snapshotBytes = persistenceService.exportSqliteDatabase();

    // Reset database to empty
    const freshDb = await resetTestDb();
    runMigrations(freshDb);
    const beforeCount = freshDb.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
    expect(beforeCount.c).toBe(0);

    // Import the snapshot
    const result = await persistenceService.importSqliteDatabase(snapshotBytes);
    expect(result.success).toBe(true);
    expect(result.version).toBeGreaterThanOrEqual(1);

    // Verify user is restored from snapshot in active database
    const currentDb = (await import("../../src/lib/db/connection")).getDb();
    const restoredUser = currentDb.prepare("SELECT email FROM users WHERE id = ?").get("imported-user-1") as { email: string } | undefined;
    expect(restoredUser?.email).toBe("snapshot@mac.local");
  });
});
