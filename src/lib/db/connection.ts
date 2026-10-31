import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import type { ISqlDatabase, ISqlStatement } from "./types";

let activeDbInstance: SqlJsWrapper | null = null;
let sqlJsModulePromise: ReturnType<typeof initSqlJs> | null = null;

const IDB_NAME = "kanban_local_storage";
const IDB_STORE = "sqlite_file";
const IDB_KEY = "kanban.db";

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * SQLite 3 database file header magic bytes: "SQLite format 3\0"
 */
export const SQLITE_MAGIC_HEADER = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]);

/**
 * Checks if the given buffer starts with the valid 16-byte SQLite 3 magic header.
 */
export function isValidSqliteDatabase(bytes: unknown): bytes is Uint8Array {
  if (!(bytes instanceof Uint8Array)) return false;
  if (bytes.byteLength < 16) return false;
  for (let i = 0; i < 16; i++) {
    if (bytes[i] !== SQLITE_MAGIC_HEADER[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Deletes any saved database from IndexedDB.
 * Used for self-healing corrupt databases and test isolation.
 */
export async function clearDbFromIndexedDb(): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return;
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          resolve();
          return;
        }
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.delete(IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function getCanonicalRepoDir(): string {
  if (typeof process !== "undefined" && process.env?.KANBAN_REPO_DIR) {
    return process.env.KANBAN_REPO_DIR;
  }
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return process.cwd();
  }
  return "";
}

function resolveSqliteDiskPath(nodeFs: any, nodePath: any): string {
  if (process.env.KANBAN_DB_PATH) return process.env.KANBAN_DB_PATH;
  // In test environment, NEVER touch the user's production desktop database!
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return nodePath.resolve(getCanonicalRepoDir(), "data/test_kanban.sqlite");
  }
  const homeDir = (typeof process !== "undefined" && process.env?.HOME) ? process.env.HOME : "";
  if (homeDir) {
    const releaseDb = nodePath.join(homeDir, "Library/Application Support/com.kanban.macos/kanban.db");
    if (nodeFs.existsSync(releaseDb)) {
      return releaseDb;
    }
  }
  return nodePath.resolve(getCanonicalRepoDir(), "data/kanban.sqlite");
}

async function loadDbFromFile(): Promise<Uint8Array | null> {
  if (typeof window !== "undefined") return null;
  // In test environment, avoid loading production database from disk
  if (process.env.VITEST || process.env.NODE_ENV === "test") return null;
  try {
    const nodeFs = await import(/* @vite-ignore */ "node:fs");
    const nodePath = await import(/* @vite-ignore */ "node:path");
    const dbPath = resolveSqliteDiskPath(nodeFs, nodePath);
    if (nodeFs.existsSync(dbPath)) {
      const buffer = nodeFs.readFileSync(dbPath);
      if (buffer.length >= 16) {
        const uint8 = new Uint8Array(buffer);
        if (isValidSqliteDatabase(uint8)) {
          return uint8;
        }
      }
    }
  } catch {
    // Ignore in non-Node environments
  }
  return null;
}

async function saveDbToFile(bytes: Uint8Array): Promise<void> {
  if (typeof window !== "undefined") return;
  // Never write to disk during unit tests
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (!isValidSqliteDatabase(bytes)) return;
  try {
    const nodeFs = await import(/* @vite-ignore */ "node:fs");
    const nodePath = await import(/* @vite-ignore */ "node:path");
    const dbPath = resolveSqliteDiskPath(nodeFs, nodePath);
    nodeFs.mkdirSync(nodePath.dirname(dbPath), { recursive: true });
    nodeFs.writeFileSync(dbPath, bytes);
  } catch (err) {
    console.error("Save SQLite to disk failed:", err);
  }
}

export async function loadDbFromIndexedDb(): Promise<Uint8Array | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return loadDbFromFile();
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get(IDB_KEY);
        getReq.onsuccess = () => {
          if (getReq.result instanceof Uint8Array && getReq.result.byteLength > 0) {
            if (isValidSqliteDatabase(getReq.result)) {
              resolve(getReq.result);
            } else {
              console.warn("Corrupted or non-SQLite data detected in IndexedDB. Clearing storage.");
              try {
                store.delete(IDB_KEY);
              } catch {}
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDbToIndexedDb(bytes: Uint8Array): Promise<void> {
  if (!isValidSqliteDatabase(bytes)) {
    console.warn("Attempted to save invalid SQLite data to storage. Operation aborted.");
    return;
  }

  if (typeof window === "undefined") {
    return saveDbToFile(bytes);
  }

  // In Tauri desktop mode, also persist directly to native macOS disk
  try {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      invoke("save_database_to_disk", { bytes: Array.from(bytes) }).catch((err) => {
        console.warn("Save database to native disk error:", err);
      });
    }
  } catch {
    // Non-Tauri environment or dynamic import error
  }

  // In browser dev mode, also sync with local dev server if available
  const isDev = typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV);
  if (isDev && typeof fetch !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes as unknown as BodyInit,
    }).catch(() => {
      // Offline mode or production build
    });
  }

  if (typeof indexedDB === "undefined") {
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put(bytes, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

export function scheduleDbSave(): void {
  if (!activeDbInstance) return;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    if (activeDbInstance) {
      try {
        const bytes = activeDbInstance.export();
        await saveDbToIndexedDb(bytes);
      } catch (err) {
        console.error("Auto-save SQLite database failed:", err);
      }
    }
  }, typeof window === "undefined" ? 10 : 200);
}

export async function flushDbSave(): Promise<void> {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }
  if (activeDbInstance) {
    try {
      const bytes = activeDbInstance.export();
      await saveDbToIndexedDb(bytes);
    } catch (err) {
      console.error("Flush SQLite database save failed:", err);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (activeDbInstance) {
      try {
        const bytes = activeDbInstance.export();
        // Fallback synchronous or direct attempt
        saveDbToIndexedDb(bytes);
      } catch {
        // Ignore during unload
      }
    }
  });
}


async function loadWasmBinary(): Promise<ArrayBuffer | undefined> {
  if (typeof window !== "undefined") return undefined;
  try {
    const nodeFs = await import(/* @vite-ignore */ "node:fs");
    const nodePath = await import(/* @vite-ignore */ "node:path");
    const bundleDir = typeof import.meta !== "undefined" && import.meta.url
      ? nodePath.dirname(new URL(import.meta.url).pathname)
      : "";
    const repoDir = getCanonicalRepoDir();
    const candidatePaths = [
      bundleDir ? nodePath.join(bundleDir, "sql-wasm.wasm") : "",
      "/Applications/Kanban.app/Contents/Resources/mcp/sql-wasm.wasm",
      repoDir ? nodePath.join(repoDir, "dist/mcp/sql-wasm.wasm") : "",
      repoDir ? nodePath.join(repoDir, "public/sql-wasm.wasm") : "",
      repoDir ? nodePath.join(repoDir, "node_modules/sql.js/dist/sql-wasm.wasm") : "",
    ];
    for (const cand of candidatePaths) {
      if (cand && nodeFs.existsSync(cand)) {
        const buf = nodeFs.readFileSync(cand);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      }
    }
  } catch {
    // Fallback
  }
  return undefined;
}

async function getSqlJsModule() {
  if (!sqlJsModulePromise) {
    const wasmBinary = await loadWasmBinary();
    sqlJsModulePromise = initSqlJs({
      locateFile: (file: string) => {
        if (typeof window !== "undefined") {
          return `/${file}`;
        }
        return file;
      },
      wasmBinary,
    });
  }
  return sqlJsModulePromise;
}

/**
 * Universal wrapper around sql.js implementing ISqlDatabase.
 */
export class SqlJsWrapper implements ISqlDatabase {
  private rawDb: SqlJsDatabase;

  constructor(rawDb: SqlJsDatabase) {
    this.rawDb = rawDb;
    this.rawDb.run("PRAGMA foreign_keys = ON;");
  }

  exec(sql: string): void {
    this.rawDb.run(sql);
    const upper = sql.trim().toUpperCase();
    if (
      upper.startsWith("INSERT") ||
      upper.startsWith("UPDATE") ||
      upper.startsWith("DELETE") ||
      upper.startsWith("CREATE") ||
      upper.startsWith("DROP") ||
      upper.startsWith("ALTER")
    ) {
      scheduleDbSave();
    }
  }

  prepare(sql: string): ISqlStatement {
    const raw = this.rawDb;

    return {
      run: (...params: unknown[]) => {
        raw.run(sql, params as (number | string | Uint8Array | null)[]);
        scheduleDbSave();
        return {
          changes: raw.getRowsModified(),
        };
      },
      get: (...params: unknown[]) => {
        const stmt = raw.prepare(sql);
        stmt.bind(params as (number | string | Uint8Array | null)[]);
        let result: any = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all: (...params: unknown[]) => {
        const stmt = raw.prepare(sql);
        stmt.bind(params as (number | string | Uint8Array | null)[]);
        const rows: any[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
    };
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.exec("BEGIN TRANSACTION;");
      try {
        const res = fn();
        this.exec("COMMIT;");
        scheduleDbSave();
        return res;
      } catch (err) {
        this.exec("ROLLBACK;");
        throw err;
      }
    };
  }

  pragma(pragmaSql: string, options?: { simple?: boolean }): any {
    const clean = pragmaSql.trim().replace(/^PRAGMA\s+/i, "").replace(/;$/, "");
    if (clean.includes("=")) {
      this.exec(`PRAGMA ${clean};`);
      return;
    }

    const res = this.rawDb.exec(`PRAGMA ${clean};`);
    if (!res || res.length === 0 || !res[0].values || res[0].values.length === 0) {
      return options?.simple ? null : [];
    }

    if (options?.simple) {
      return res[0].values[0][0];
    }

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, any> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  close(): void {
    try {
      this.rawDb.close();
    } catch {
      // Ignore
    }
  }

  export(): Uint8Array {
    return this.rawDb.export();
  }
}

/**
 * Creates and initializes a database connection.
 * If in browser and no initialBytes supplied, attempts to load existing bytes from IndexedDB.
 */
export async function initDb(initialBytes?: Uint8Array): Promise<ISqlDatabase> {
  const SQL = await getSqlJsModule();
  let bytes = initialBytes;
  if (!bytes) {
    // If running in Tauri desktop, attempt to load directly from persistent native disk first
    if (typeof window !== "undefined") {
      try {
        const { isTauri, invoke } = await import("@tauri-apps/api/core");
        if (isTauri()) {
          const diskBytes = await invoke<number[] | null>("load_database_from_disk");
          if (diskBytes && diskBytes.length >= 16) {
            const candidate = new Uint8Array(diskBytes);
            if (isValidSqliteDatabase(candidate)) {
              bytes = candidate;
              await saveDbToIndexedDb(bytes);
            }
          }
        }
      } catch (err) {
        console.warn("Loading database from native disk warning:", err);
      }
    }

    if (!bytes) {
      const stored = await loadDbFromIndexedDb();
      if (stored && stored.byteLength > 0 && isValidSqliteDatabase(stored)) {
        bytes = stored;
      // In dev mode only, push to disk via /api/db if dev server running
      const isDev = typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV);
      if (isDev && typeof window !== "undefined" && typeof fetch !== "undefined") {
        fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: stored as unknown as BodyInit,
        }).catch(() => {});
      }
    } else {
      const isDev = typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV);
      if (isDev && typeof window !== "undefined" && typeof fetch !== "undefined") {
        try {
          const res = await fetch("/api/db");
          const contentType = res.headers.get("content-type") || "";
          if (res.ok && contentType.includes("application/octet-stream")) {
            const buf = await res.arrayBuffer();
            if (buf.byteLength >= 16) {
              const candidate = new Uint8Array(buf);
              if (isValidSqliteDatabase(candidate)) {
                bytes = candidate;
                await saveDbToIndexedDb(bytes);
              }
            }
          }
        } catch {}
      }
    }
  }
  }

  let raw: SqlJsDatabase;
  try {
    raw = bytes && isValidSqliteDatabase(bytes) ? new SQL.Database(bytes) : new SQL.Database();
  } catch (err) {
    console.error("Failed to initialize SQLite database with provided bytes. Recovering with fresh database:", err);
    await clearDbFromIndexedDb();
    raw = new SQL.Database();
  }

  activeDbInstance = new SqlJsWrapper(raw);
  return activeDbInstance;
}

/**
 * Returns the currently active ISqlDatabase, or throws if not initialized.
 */
export function getDb(): ISqlDatabase {
  if (!activeDbInstance) {
    throw new Error("Database not initialized. Await initDb() first.");
  }
  return activeDbInstance;
}

/**
 * Sets the active database instance.
 */
export function setDb(db: ISqlDatabase): void {
  activeDbInstance = db as SqlJsWrapper;
  scheduleDbSave();
}

/**
 * Resets the active database connection for test isolation.
 */
export async function resetTestDb(): Promise<ISqlDatabase> {
  closeDb();
  const SQL = await getSqlJsModule();
  const raw = new SQL.Database();
  activeDbInstance = new SqlJsWrapper(raw);
  return activeDbInstance;
}

/**
 * Closes the active database connection.
 */
export function closeDb(): void {
  if (activeDbInstance) {
    activeDbInstance.close();
    activeDbInstance = null;
  }
}

/**
 * Helper to run a callback inside an atomic transaction.
 */
export function runInTransaction<T>(callback: (db: ISqlDatabase) => T): T {
  const db = getDb();
  const txn = db.transaction(() => callback(db));
  return txn();
}
