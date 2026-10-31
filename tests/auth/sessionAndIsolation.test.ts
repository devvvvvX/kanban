import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import { SessionService } from "../../src/lib/auth/sessionService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("Session & Account Isolation (AUTH-05, AUTH-06, AUTH-07)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;
  let sessionService: SessionService;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
    sessionService = new SessionService(db);
  });

  afterEach(() => {
    closeDb();
  });

  it("AUTH-05: enforces configurable session duration between 30 and 180 days", async () => {
    const { user, recoveryKey } = await authService.register("session-user@mac.local", "StrongPass123!");
    await authService.confirmRecoveryKey(user.id, recoveryKey);

    // Default duration: 30 days
    const sessDefault = sessionService.createSession(user.id);
    expect(sessDefault.duration_days).toBe(30);

    // Clamps minimum to 30 days
    const sessLow = sessionService.createSession(user.id, 10);
    expect(sessLow.duration_days).toBe(30);

    // Custom 90 days
    const sessCustom = sessionService.createSession(user.id, 90);
    expect(sessCustom.duration_days).toBe(90);

    // Clamps maximum to 180 days
    const sessHigh = sessionService.createSession(user.id, 365);
    expect(sessHigh.duration_days).toBe(180);

    // Validate active session
    const validResult = sessionService.validateSession(sessCustom.token);
    expect(validResult.valid).toBe(true);
    expect(validResult.user?.id).toBe(user.id);
  });

  it("AUTH-05: detects expired sessions and cleans them up automatically", async () => {
    const { user, recoveryKey } = await authService.register("expiring-user@mac.local", "StrongPass123!");
    await authService.confirmRecoveryKey(user.id, recoveryKey);

    const session = sessionService.createSession(user.id, 30);

    // Manually backdate expiration to 1 hour ago
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(past, session.id);

    const check = sessionService.validateSession(session.token);
    expect(check.valid).toBe(false);
    expect(check.expired).toBe(true);

    // Record should be pruned from DB
    const inDb = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE id = ?").get(session.id) as { c: number };
    expect(inDb.c).toBe(0);
  });

  it("AUTH-06: maintains strict isolation across multiple local accounts and supports clean switching", async () => {
    const u1 = await authService.register("account-a@mac.local", "PassUserA123!");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);

    const u2 = await authService.register("account-b@mac.local", "PassUserB123!");
    await authService.confirmRecoveryKey(u2.user.id, u2.recoveryKey);

    const sessA = sessionService.createSession(u1.user.id, 30);
    const sessB = sessionService.createSession(u2.user.id, 60);
    expect(sessB.duration_days).toBe(60);

    // Account A's session verifies Account A ownership and rejects Account B
    expect(() => sessionService.assertAccountOwnership(sessA.token, u1.user.id)).not.toThrow();
    expect(() => sessionService.assertAccountOwnership(sessA.token, u2.user.id)).toThrow(/Security Violation/);

    // Switch account from A to B: old session destroyed, new session created for B
    const switchedSess = sessionService.switchAccount(sessA.token, u2.user.id);
    expect(switchedSess.user_id).toBe(u2.user.id);

    // Old sessA token is now invalidated
    const oldCheck = sessionService.validateSession(sessA.token);
    expect(oldCheck.valid).toBe(false);

    // New session is valid for Account B
    const newCheck = sessionService.validateSession(switchedSess.token);
    expect(newCheck.valid).toBe(true);
    expect(newCheck.user?.id).toBe(u2.user.id);
  });

  it("AUTH-07: secure logout clears session token and invalidates access", async () => {
    const { user, recoveryKey } = await authService.register("logout-test@mac.local", "Password123!");
    await authService.confirmRecoveryKey(user.id, recoveryKey);

    const session = sessionService.createSession(user.id, 30);
    expect(sessionService.validateSession(session.token).valid).toBe(true);

    // Logout destroys session
    sessionService.destroySession(session.token);
    expect(sessionService.validateSession(session.token).valid).toBe(false);

    // Subsequent assertion fails
    expect(() => sessionService.assertAccountOwnership(session.token, user.id)).toThrow(/Unauthorized/);
  });
});
