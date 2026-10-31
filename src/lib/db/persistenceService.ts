import { getDb, initDb, isValidSqliteDatabase, flushDbSave, saveDbToIndexedDb } from "./connection";
import { runMigrations } from "./migrations";
import { isTauri, invoke } from "@tauri-apps/api/core";

export interface DatabaseStorageInfo {
  isNativeTauri: boolean;
  storageType: string;
  databasePath: string;
  sizeBytes: number;
  lastUpdated: string;
}

export class DatabasePersistenceService {
  /**
   * Retrieves metadata about where the active database is persisted.
   */
  async getStorageInfo(): Promise<DatabaseStorageInfo> {
    const db = getDb();
    if (!db.export) {
      throw new Error("Database export is not supported by current database driver");
    }
    const bytes = db.export();
    const sizeBytes = bytes.byteLength;
    const now = new Date().toISOString();

    if (typeof window !== "undefined" && isTauri()) {
      try {
        const diskPath = await invoke<string>("get_database_path");
        return {
          isNativeTauri: true,
          storageType: "macOS Application Support (Persistent)",
          databasePath: diskPath,
          sizeBytes,
          lastUpdated: now,
        };
      } catch {
        // Fallback if invoke fails
      }
    }

    if (typeof window !== "undefined") {
      const isDev = Boolean((import.meta as any).env?.DEV);
      return {
        isNativeTauri: false,
        storageType: isDev ? "Vite Dev Sync (data/kanban.sqlite)" : "Browser IndexedDB",
        databasePath: isDev ? "data/kanban.sqlite" : "IndexedDB (kanban_local_storage / kanban.db)",
        sizeBytes,
        lastUpdated: now,
      };
    }

    const nodePath = process.env.KANBAN_DB_PATH || "data/kanban.sqlite";
    return {
      isNativeTauri: false,
      storageType: "Node Local File",
      databasePath: nodePath,
      sizeBytes,
      lastUpdated: now,
    };
  }

  /**
   * Reveals the SQLite database folder or file in macOS Finder.
   */
  async showInFinder(): Promise<boolean> {
    if (typeof window !== "undefined" && isTauri()) {
      try {
        await invoke("show_in_finder");
        return true;
      } catch (err) {
        console.error("Failed to show in Finder:", err);
      }
    }
    return false;
  }

  /**
   * Exports the active SQLite database directly as a downloadable binary file (.sqlite).
   */
  exportSqliteDatabase(): Uint8Array {
    const db = getDb();
    if (!db.export) {
      throw new Error("Database export is not supported by current database driver");
    }
    const bytes = db.export();
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/x-sqlite3" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kanban-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return bytes;
  }

  /**
   * Imports a raw SQLite database, validating the magic header, applying any pending migrations,
   * saving to native disk & IndexedDB, and returning the new migration version.
   */
  async importSqliteDatabase(candidateBytes: Uint8Array): Promise<{ success: boolean; version: number }> {
    if (!isValidSqliteDatabase(candidateBytes)) {
      throw new Error("Invalid SQLite database file. Header must match 'SQLite format 3\\0'.");
    }

    // Re-initialize active DB instance with candidate bytes
    await initDb(candidateBytes);
    
    // Ensure all migrations run on the imported schema
    const migrationResult = runMigrations();

    // Persist immediately to disk and IndexedDB
    await saveDbToIndexedDb(candidateBytes);
    await flushDbSave();

    return {
      success: true,
      version: migrationResult.currentVersion,
    };
  }
}
