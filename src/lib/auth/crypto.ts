import { argon2id, argon2Verify } from "hash-wasm";
import type { ISqlDatabase } from "../db/types";

/**
 * Standard OWASP-recommended Argon2id parameters for interactive desktop auth.
 * Memory: 19456 KiB (~19 MiB), Iterations: 2, Parallelism: 1, 32-byte hash.
 */
export const ARGON2_CONFIG = {
  iterations: 2,
  memorySize: 19456,
  parallelism: 1,
  hashLength: 32,
  outputType: "encoded" as const,
};

/**
 * Hashes a plaintext password using Argon2id with a cryptographically secure random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  return argon2id({
    password,
    salt,
    ...ARGON2_CONFIG,
  });
}

/**
 * Verifies a password against an Argon2id hash in constant time.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await argon2Verify({
      password,
      hash,
    });
  } catch {
    return false;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  delayMs: number;
  remainingSeconds: number;
  consecutiveFailures: number;
}

/**
 * Checks rate limiting and backoff for failed login attempts on a given email.
 */
export function checkLoginRateLimit(db: ISqlDatabase, email: string): RateLimitResult {
  const normalizedEmail = email.trim().toLowerCase();
  const row = db.prepare("SELECT failed_count, last_failed_at, locked_until FROM login_attempts WHERE email = ?").get(normalizedEmail) as
    | { failed_count: number; last_failed_at: string; locked_until: string | null }
    | undefined;

  if (!row || row.failed_count === 0) {
    return { allowed: true, delayMs: 0, remainingSeconds: 0, consecutiveFailures: 0 };
  }

  const now = Date.now();
  if (row.locked_until) {
    const lockTime = new Date(row.locked_until).getTime();
    if (lockTime > now) {
      const remainingSeconds = Math.ceil((lockTime - now) / 1000);
      return {
        allowed: false,
        delayMs: lockTime - now,
        remainingSeconds,
        consecutiveFailures: row.failed_count,
      };
    }
  }

  return { allowed: true, delayMs: 0, remainingSeconds: 0, consecutiveFailures: row.failed_count };
}

/**
 * Records a failed login attempt and calculates exponential backoff.
 */
export function recordFailedLogin(db: ISqlDatabase, email: string): RateLimitResult {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const nowMs = now.getTime();

  const current = db.prepare("SELECT failed_count FROM login_attempts WHERE email = ?").get(normalizedEmail) as
    | { failed_count: number }
    | undefined;

  const count = (current?.failed_count ?? 0) + 1;
  let delayMs = 0;

  if (count >= 5) {
    // Exponential backoff: 5 attempts = 5s, 6 = 10s, 7 = 20s, 8+ = 30s max
    delayMs = Math.min(30000, 2500 * Math.pow(2, count - 5));
  } else if (count >= 3) {
    delayMs = 2000;
  }

  const lockedUntil = delayMs > 0 ? new Date(nowMs + delayMs).toISOString() : null;

  db.prepare(`
    INSERT INTO login_attempts (email, failed_count, last_failed_at, locked_until)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      failed_count = excluded.failed_count,
      last_failed_at = excluded.last_failed_at,
      locked_until = excluded.locked_until
  `).run(normalizedEmail, count, now.toISOString(), lockedUntil);

  return {
    allowed: delayMs === 0,
    delayMs,
    remainingSeconds: Math.ceil(delayMs / 1000),
    consecutiveFailures: count,
  };
}

/**
 * Resets failed login attempt counter upon successful login.
 */
export function resetLoginAttempts(db: ISqlDatabase, email: string): void {
  const normalizedEmail = email.trim().toLowerCase();
  db.prepare("DELETE FROM login_attempts WHERE email = ?").run(normalizedEmail);
}

/**
 * Constant time string comparison helper.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
