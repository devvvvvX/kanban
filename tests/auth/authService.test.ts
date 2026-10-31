import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetTestDb, closeDb } from "../../src/lib/db/connection";
import { runMigrations } from "../../src/lib/db/migrations";
import { AuthService } from "../../src/lib/auth/authService";
import type { ISqlDatabase } from "../../src/lib/db/types";

describe("AuthService (AUTH-01 through AUTH-04)", () => {
  let db: ISqlDatabase;
  let authService: AuthService;

  beforeEach(async () => {
    db = await resetTestDb();
    runMigrations(db);
    authService = new AuthService(db);
  });

  afterEach(() => {
    closeDb();
  });

  it("AUTH-01 & AUTH-02: registers account in pending status and requires recovery key confirmation", async () => {
    const { user, recoveryKey } = await authService.register("developer@example.com", "SecurePassword123!", "Lead Dev");

    expect(user.status).toBe("pending");
    expect(user.email).toBe("developer@example.com");
    expect(recoveryKey).toMatch(/^REC-/);

    // Attempting login while pending should be refused
    const loginAttempt = await authService.login("developer@example.com", "SecurePassword123!");
    expect(loginAttempt.success).toBe(false);
    expect(loginAttempt.error).toContain("pending recovery key confirmation");

    // Invalid confirmation key should return false
    const badConfirm = await authService.confirmRecoveryKey(user.id, "REC-0000-0000-0000-0000");
    expect(badConfirm).toBe(false);

    // Valid confirmation activates the account
    const goodConfirm = await authService.confirmRecoveryKey(user.id, recoveryKey);
    expect(goodConfirm).toBe(true);

    const activatedUser = authService.getUserById(user.id);
    expect(activatedUser?.status).toBe("active");

    // Now login should succeed
    const loginOk = await authService.login("developer@example.com", "SecurePassword123!");
    expect(loginOk.success).toBe(true);
    expect(loginOk.user?.id).toBe(user.id);
  });

  it("AUTH-03: validates credentials via Argon2id with backoff on repeated bad attempts", async () => {
    const { user, recoveryKey } = await authService.register("coder@mac.local", "CodeRock123$", "Coder");
    await authService.confirmRecoveryKey(user.id, recoveryKey);

    // Bad password attempts
    const bad1 = await authService.login("coder@mac.local", "WrongPassword1");
    expect(bad1.success).toBe(false);

    await authService.login("coder@mac.local", "WrongPassword2");
    const bad3 = await authService.login("coder@mac.local", "WrongPassword3");
    expect(bad3.success).toBe(false);
    expect(bad3.remainingSeconds).toBeGreaterThan(0);

    // Trying again immediately hits rate limiter
    const rateLimited = await authService.login("coder@mac.local", "CodeRock123$");
    expect(rateLimited.success).toBe(false);
    expect(rateLimited.error).toContain("Too many failed attempts");
  });

  it("AUTH-04: resets password completely offline using recovery key", async () => {
    const { user, recoveryKey } = await authService.register("offline@mac.local", "InitialPass1234", "Offline User");
    await authService.confirmRecoveryKey(user.id, recoveryKey);

    // Reset password with recovery key
    const resetOk = await authService.resetPasswordWithRecoveryKey("offline@mac.local", recoveryKey, "BrandNewPassword999!");
    expect(resetOk).toBe(true);

    // Old password fails
    const oldLogin = await authService.login("offline@mac.local", "InitialPass1234");
    expect(oldLogin.success).toBe(false);

    // New password succeeds
    const newLogin = await authService.login("offline@mac.local", "BrandNewPassword999!");
    expect(newLogin.success).toBe(true);
    expect(newLogin.user?.id).toBe(user.id);
  });

  it("rejects reset with invalid recovery key", async () => {
    const { user, recoveryKey } = await authService.register("recovery-test@mac.local", "OriginalPass123", "Tester");
    await authService.confirmRecoveryKey(user.id, recoveryKey);

    await expect(
      authService.resetPasswordWithRecoveryKey("recovery-test@mac.local", "REC-XXXX-XXXX-XXXX-XXXX", "AnotherPass123")
    ).rejects.toThrow(/Invalid recovery key/);
  });

  it("lists all registered local accounts on this Mac", async () => {
    const u1 = await authService.register("one@test.local", "Password1234");
    await authService.register("two@test.local", "Password1234");
    await authService.confirmRecoveryKey(u1.user.id, u1.recoveryKey);

    const accounts = authService.listLocalAccounts();
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.email)).toEqual(["one@test.local", "two@test.local"]);
  });

  it("resumes pending registration by verifying password and returning fresh recovery key", async () => {
    const { user } = await authService.register("pending-user@test.local", "InitialPass123!", "Pending Guy");
    expect(user.status).toBe("pending");

    // Invalid password fails
    await expect(
      authService.resumePendingRegistration("pending-user@test.local", "WrongPassword!")
    ).rejects.toThrow("Invalid password for this pending account");

    // Correct password generates fresh recovery key
    const resumed = await authService.resumePendingRegistration("pending-user@test.local", "InitialPass123!");
    expect(resumed.recoveryKey).toMatch(/^REC-/);
    expect(resumed.user.id).toBe(user.id);

    // Confirming fresh recovery key activates the account
    const confirmed = await authService.confirmRecoveryKey(user.id, resumed.recoveryKey);
    expect(confirmed).toBe(true);

    const loginRes = await authService.login("pending-user@test.local", "InitialPass123!");
    expect(loginRes.success).toBe(true);
  });

  it("allows re-registering if previous registration was pending and unconfirmed", async () => {
    await authService.register("replace-pending@test.local", "OldPassword123!", "Old Name");
    
    // Registering again with same email replaces the unconfirmed record
    const r2 = await authService.register("replace-pending@test.local", "NewPassword456!", "New Name");
    expect(r2.recoveryKey).toMatch(/^REC-/);
    
    // Confirm new key and log in with new password
    await authService.confirmRecoveryKey(r2.user.id, r2.recoveryKey);
    const loginOk = await authService.login("replace-pending@test.local", "NewPassword456!");
    expect(loginOk.success).toBe(true);
    expect(loginOk.user?.display_name).toBe("New Name");
  });
});
