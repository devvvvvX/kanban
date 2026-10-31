import { describe, it, expect, afterEach } from "vitest";
import {
  initDb,
  resetTestDb,
  closeDb,
  isValidSqliteDatabase,
  SQLITE_MAGIC_HEADER,
  saveDbToIndexedDb,
} from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";

describe("Database Connection & Resilience", () => {
  afterEach(() => {
    closeDb();
  });

  describe("isValidSqliteDatabase", () => {
    it("returns true for valid SQLite 3 magic header", () => {
      const validDb = new Uint8Array(100);
      validDb.set(SQLITE_MAGIC_HEADER, 0);
      expect(isValidSqliteDatabase(validDb)).toBe(true);
    });

    it("returns false for HTML SPA fallback payload", () => {
      const htmlPayload = new TextEncoder().encode(
        "<!doctype html><html lang=\"en\"><head><title>App</title></head><body><div id=\"root\"></div></body></html>"
      );
      expect(isValidSqliteDatabase(htmlPayload)).toBe(false);
    });

    it("returns false for truncated or empty buffers", () => {
      expect(isValidSqliteDatabase(new Uint8Array(0))).toBe(false);
      expect(isValidSqliteDatabase(new Uint8Array(15))).toBe(false);
    });

    it("returns false for non-Uint8Array types", () => {
      expect(isValidSqliteDatabase(null)).toBe(false);
      expect(isValidSqliteDatabase(undefined)).toBe(false);
      expect(isValidSqliteDatabase("SQLite format 3\0")).toBe(false);
      expect(isValidSqliteDatabase({ length: 16 })).toBe(false);
    });
  });

  describe("Self-healing initDb resilience", () => {
    it("safely recovers with a fresh database when initialized with corrupted/HTML bytes", async () => {
      const corruptedHtmlBytes = new TextEncoder().encode("<!doctype html><html><body>Corrupted SPA Payload</body></html>");

      // Before our fix, this would throw "Error: file is not a database" and crash AuthContext
      const db = await initDb(corruptedHtmlBytes);
      expect(db).toBeDefined();

      // Ensure migrations and operations work cleanly on the recovered database
      const migResult = runMigrations(db);
      expect(migResult.applied).toBe(12);

      const tables = db.pragma("table_list") as Array<{ name: string }>;
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("users");
      expect(tableNames).toContain("tickets");
      expect(tableNames).toContain("ticket_attachments");
      expect(tableNames).toContain("notes");
      expect(tableNames).toContain("todos");
    });

    it("successfully loads valid existing SQLite database bytes", async () => {
      const initialDb = await resetTestDb();
      runMigrations(initialDb);
      initialDb.exec("INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at) VALUES ('u1', 'test@example.com', 'h1', 'Tester', 'active', '2026-01-01', '2026-01-01')");

      expect(initialDb.export).toBeDefined();
      const exportedBytes = initialDb.export!();
      expect(isValidSqliteDatabase(exportedBytes)).toBe(true);
      closeDb();

      // Re-open with valid bytes
      const restoredDb = await initDb(exportedBytes);
      const user = restoredDb.prepare("SELECT email, display_name FROM users WHERE id = 'u1'").get() as { email: string; display_name: string };
      expect(user).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.display_name).toBe("Tester");
    });

    it("rejects saving invalid non-SQLite bytes via saveDbToIndexedDb", async () => {
      const invalidBytes = new TextEncoder().encode("Not a database");
      // Should not throw and should safely reject
      await expect(saveDbToIndexedDb(invalidBytes)).resolves.toBeUndefined();
    });
  });
});
