import type { ISqlDatabase } from "../types";

export interface Migration {
  version: number;
  name: string;
  up: (db: ISqlDatabase) => void;
  down: (db: ISqlDatabase) => void;
}

export const migration0001: Migration = {
  version: 1,
  name: "initial_auth_and_account_isolation",
  up: (db: ISqlDatabase) => {
    // 1. Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'suspended')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // 2. Recovery verifiers table (one-way Argon2id hash of high-entropy recovery key)
    db.exec(`
      CREATE TABLE IF NOT EXISTS recovery_verifiers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        verifier_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_recovery_verifiers_user ON recovery_verifiers(user_id);
    `);

    // 3. Sessions table (with configurable duration 30-180 days and keep_signed_in)
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        duration_days INTEGER NOT NULL DEFAULT 30,
        keep_signed_in INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);

    // 4. Login attempts table (for rate limiting and backoff protection)
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        email TEXT PRIMARY KEY COLLATE NOCASE,
        failed_count INTEGER NOT NULL DEFAULT 0,
        last_failed_at TEXT NOT NULL,
        locked_until TEXT
      );
    `);

    // 5. User preferences table (session duration, theme, appearance)
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT NOT NULL DEFAULT 'system',
        session_duration_days INTEGER NOT NULL DEFAULT 30,
        density TEXT NOT NULL DEFAULT 'comfortable',
        reduced_motion INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
  },
  down: (db: ISqlDatabase) => {
    db.exec(`
      DROP TABLE IF EXISTS user_preferences;
      DROP TABLE IF EXISTS login_attempts;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS recovery_verifiers;
      DROP TABLE IF EXISTS users;
    `);
  },
};
