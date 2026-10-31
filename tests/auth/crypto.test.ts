import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import {
  hashPassword,
  verifyPassword,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  safeEqual,
} from "../../src/lib/auth/crypto";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("Auth Crypto & Rate Limiter", () => {
  let db: ISqlDatabase;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
  });

  afterEach(() => {
    closeDb();
  });

  it("hashes password with Argon2id and verifies correctly", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);

    expect(hash).toContain("$argon2id$");

    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("wrong-password-1234", hash);
    expect(invalid).toBe(false);
  });

  it("rejects passwords under 8 characters", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least 8 characters/);
  });

  it("enforces rate limiting and exponential backoff after failed attempts", () => {
    const email = "bob@example.com";

    // Initial check: allowed
    expect(checkLoginRateLimit(db, email).allowed).toBe(true);

    // 1st and 2nd failed attempt: still allowed without delay
    recordFailedLogin(db, email);
    recordFailedLogin(db, email);
    expect(checkLoginRateLimit(db, email).allowed).toBe(true);

    // 3rd failed attempt: introduces 2s delay
    const attempt3 = recordFailedLogin(db, email);
    expect(attempt3.allowed).toBe(false);
    expect(attempt3.delayMs).toBe(2000);

    // Check rate limit status reports locked
    const lockedCheck = checkLoginRateLimit(db, email);
    expect(lockedCheck.allowed).toBe(false);
    expect(lockedCheck.remainingSeconds).toBeGreaterThan(0);

    // Reset attempts on success clears lockout
    resetLoginAttempts(db, email);
    expect(checkLoginRateLimit(db, email).allowed).toBe(true);
    expect(checkLoginRateLimit(db, email).consecutiveFailures).toBe(0);
  });

  it("safely compares strings in constant time", () => {
    expect(safeEqual("token-abc", "token-abc")).toBe(true);
    expect(safeEqual("token-abc", "token-xyz")).toBe(false);
    expect(safeEqual("short", "longer-string")).toBe(false);
  });
});
