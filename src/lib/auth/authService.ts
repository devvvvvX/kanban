import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import { hashPassword, verifyPassword, checkLoginRateLimit, recordFailedLogin, resetLoginAttempts } from "./crypto";
import { generateRecoveryKey, deriveRecoveryVerifier, verifyRecoveryKey } from "./recovery";

export interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  status: "pending" | "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface RegistrationResult {
  user: UserRecord;
  recoveryKey: string;
}

export interface LoginResult {
  success: boolean;
  user?: UserRecord;
  sessionToken?: string;
  error?: string;
  remainingSeconds?: number;
}

export class AuthService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Registers a new local account. Generates a 128-bit recovery key and stores its hash.
   * Sets status to 'pending' until recovery key confirmation is supplied.
   */
  async register(email: string, password: string, displayName?: string): Promise<RegistrationResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("Invalid email address");
    }
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const existing = this.db.prepare("SELECT id, status FROM users WHERE email = ?").get(normalizedEmail) as
      | { id: string; status: string }
      | undefined;
    if (existing) {
      if (existing.status === "pending") {
        // If registration was never confirmed, delete unconfirmed user so registration can restart cleanly
        this.db.prepare("DELETE FROM users WHERE id = ?").run(existing.id);
      } else {
        throw new Error("An account with this email already exists on this Mac");
      }
    }

    const userId = crypto.randomUUID();
    const verifierId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const recoveryKey = generateRecoveryKey();
    const verifierHash = await deriveRecoveryVerifier(recoveryKey);
    const now = new Date().toISOString();
    const name = displayName?.trim() || normalizedEmail.split("@")[0];

    const insertTxn = this.db.transaction(() => {
      // 1. Create user in pending status
      this.db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `).run(userId, normalizedEmail, passwordHash, name, now, now);

      // 2. Store recovery verifier hash
      this.db.prepare(`
        INSERT INTO recovery_verifiers (id, user_id, verifier_hash, created_at)
        VALUES (?, ?, ?, ?)
      `).run(verifierId, userId, verifierHash, now);

      // 3. Initialize default preferences
      this.db.prepare(`
        INSERT INTO user_preferences (user_id, theme, session_duration_days, density, reduced_motion, updated_at)
        VALUES (?, 'system', 30, 'comfortable', 0, ?)
      `).run(userId, now);
    });

    insertTxn();

    const user = this.getUserById(userId);
    if (!user) throw new Error("Failed to retrieve created user");

    return { user, recoveryKey };
  }

  /**
   * Resumes a pending account registration by verifying password and generating a fresh recovery key.
   */
  async resumePendingRegistration(email: string, password: string): Promise<RegistrationResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const userRow = this.db.prepare(`
      SELECT id, email, password_hash, display_name, status, created_at, updated_at
      FROM users WHERE email = ?
    `).get(normalizedEmail) as (UserRecord & { password_hash: string }) | undefined;

    if (!userRow) {
      throw new Error("No account found with this email");
    }

    if (userRow.status !== "pending") {
      throw new Error("Account is already active. Please sign in.");
    }

    const passwordValid = await verifyPassword(password, userRow.password_hash);
    if (!passwordValid) {
      throw new Error("Invalid password for this pending account");
    }

    const recoveryKey = generateRecoveryKey();
    const verifierHash = await deriveRecoveryVerifier(recoveryKey);
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO recovery_verifiers (id, user_id, verifier_hash, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          verifier_hash = excluded.verifier_hash,
          created_at = excluded.created_at
      `).run(crypto.randomUUID(), userRow.id, verifierHash, now);
    })();

    const user = this.getUserById(userRow.id);
    if (!user) throw new Error("Failed to retrieve user");

    return { user, recoveryKey };
  }

  /**
   * Confirms recovery key possession and activates the pending user account.
   */
  async confirmRecoveryKey(userId: string, rawKey: string): Promise<boolean> {
    const verifierRow = this.db.prepare(`
      SELECT verifier_hash FROM recovery_verifiers WHERE user_id = ?
    `).get(userId) as { verifier_hash: string } | undefined;

    if (!verifierRow) {
      throw new Error("No recovery verifier found for user");
    }

    const valid = await verifyRecoveryKey(rawKey, verifierRow.verifier_hash);
    if (!valid) {
      return false;
    }

    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.prepare("UPDATE users SET status = 'active', updated_at = ? WHERE id = ?").run(now, userId);
      this.db.prepare("UPDATE recovery_verifiers SET confirmed_at = ? WHERE user_id = ?").run(now, userId);
    })();

    return true;
  }

  /**
   * Logs into an existing account with Argon2id password verification and rate limiting.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check rate limit & lockout
    const rateCheck = checkLoginRateLimit(this.db, normalizedEmail);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many failed attempts. Account locked. Please wait ${rateCheck.remainingSeconds}s before retrying.`,
        remainingSeconds: rateCheck.remainingSeconds,
      };
    }

    // 2. Fetch user
    const userRow = this.db.prepare(`
      SELECT id, email, password_hash, display_name, status, created_at, updated_at
      FROM users WHERE email = ?
    `).get(normalizedEmail) as (UserRecord & { password_hash: string }) | undefined;

    if (!userRow) {
      recordFailedLogin(this.db, normalizedEmail);
      return { success: false, error: "Invalid email or password" };
    }

    if (userRow.status === "pending") {
      return {
        success: false,
        error: "Account registration is pending recovery key confirmation.",
      };
    }

    if (userRow.status === "suspended") {
      return { success: false, error: "This local account has been suspended" };
    }

    // 3. Verify Argon2id password
    const passwordValid = await verifyPassword(password, userRow.password_hash);
    if (!passwordValid) {
      const record = recordFailedLogin(this.db, normalizedEmail);
      const backoffMsg = record.remainingSeconds > 0
        ? ` Rate limit active for ${record.remainingSeconds}s.`
        : "";
      return {
        success: false,
        error: `Invalid email or password.${backoffMsg}`,
        remainingSeconds: record.remainingSeconds,
      };
    }

    // 4. Success: reset rate limit attempts
    resetLoginAttempts(this.db, normalizedEmail);

    const user: UserRecord = {
      id: userRow.id,
      email: userRow.email,
      display_name: userRow.display_name,
      status: userRow.status,
      created_at: userRow.created_at,
      updated_at: userRow.updated_at,
    };

    return { success: true, user };
  }

  /**
   * Resets password completely offline using a verified recovery key.
   */
  async resetPasswordWithRecoveryKey(email: string, rawRecoveryKey: string, newPassword: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long");
    }

    const user = this.db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail) as { id: string } | undefined;
    if (!user) {
      throw new Error("User with this email not found");
    }

    const verifierRow = this.db.prepare("SELECT verifier_hash FROM recovery_verifiers WHERE user_id = ?").get(user.id) as
      | { verifier_hash: string }
      | undefined;

    if (!verifierRow) {
      throw new Error("No recovery verifier registered for this account");
    }

    const keyMatches = await verifyRecoveryKey(rawRecoveryKey, verifierRow.verifier_hash);
    if (!keyMatches) {
      throw new Error("Invalid recovery key provided");
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    this.db.transaction(() => {
      // 1. Update user password
      this.db.prepare("UPDATE users SET password_hash = ?, status = 'active', updated_at = ? WHERE id = ?").run(newHash, now, user.id);
      // 2. Invalidate all existing sessions
      this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
      // 3. Clear rate limiting
      resetLoginAttempts(this.db, normalizedEmail);
    })();

    return true;
  }

  /**
   * Lists all local accounts registered on this Mac (metadata only).
   */
  listLocalAccounts(): Array<{ id: string; email: string; display_name: string; status: string }> {
    return this.db.prepare(`
      SELECT id, email, display_name, status FROM users ORDER BY created_at ASC
    `).all() as Array<{ id: string; email: string; display_name: string; status: string }>;
  }

  getUserById(userId: string): UserRecord | null {
    const row = this.db.prepare(`
      SELECT id, email, display_name, status, created_at, updated_at FROM users WHERE id = ?
    `).get(userId);
    return (row as UserRecord) ?? null;
  }
}
