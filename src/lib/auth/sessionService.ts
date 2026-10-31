import type { ISqlDatabase } from "../db/types";
import { getDb } from "../db/connection";
import type { UserRecord } from "./authService";

export interface SessionRecord {
  id: string;
  user_id: string;
  token: string;
  duration_days: number;
  keep_signed_in: number;
  created_at: string;
  expires_at: string;
  last_active_at: string;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: UserRecord;
  session?: SessionRecord;
  expired?: boolean;
}

export class SessionService {
  private db: ISqlDatabase;

  constructor(db?: ISqlDatabase) {
    this.db = db ?? getDb();
  }

  /**
   * Creates a persistent session for a user.
   * Duration is clamped between 30 and 180 days (default: 30 days).
   */
  createSession(userId: string, durationDays: number = 30, keepSignedIn: boolean = true): SessionRecord {
    // Validate user exists and is active
    const user = this.db.prepare("SELECT id, status FROM users WHERE id = ?").get(userId) as
      | { id: string; status: string }
      | undefined;

    if (!user || user.status !== "active") {
      throw new Error("Cannot create session: user is not active or does not exist");
    }

    // Clamp duration between 30 and 180 days per requirements
    const validDays = Math.min(180, Math.max(30, Math.round(durationDays)));
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

    const session: SessionRecord = {
      id: sessionId,
      user_id: userId,
      token,
      duration_days: validDays,
      keep_signed_in: keepSignedIn ? 1 : 0,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_active_at: now.toISOString(),
    };

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, duration_days, keep_signed_in, created_at, expires_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.user_id,
      session.token,
      session.duration_days,
      session.keep_signed_in,
      session.created_at,
      session.expires_at,
      session.last_active_at
    );

    return session;
  }

  /**
   * Validates a session token, checking expiration and touching last_active_at.
   */
  validateSession(token: string): SessionValidationResult {
    if (!token) return { valid: false };

    const row = this.db.prepare(`
      SELECT s.id, s.user_id, s.token, s.duration_days, s.keep_signed_in, s.created_at, s.expires_at, s.last_active_at,
             u.email, u.display_name, u.status, u.created_at as user_created_at, u.updated_at as user_updated_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `).get(token) as
      | (SessionRecord & {
          email: string;
          display_name: string;
          status: "pending" | "active" | "suspended";
          user_created_at: string;
          user_updated_at: string;
        })
      | undefined;

    if (!row) {
      return { valid: false };
    }

    const now = Date.now();
    const expiresMs = new Date(row.expires_at).getTime();

    if (now > expiresMs) {
      // Session has expired
      this.destroySession(token);
      return { valid: false, expired: true };
    }

    if (row.status !== "active") {
      return { valid: false };
    }

    // Update last_active_at
    const nowIso = new Date().toISOString();
    this.db.prepare("UPDATE sessions SET last_active_at = ? WHERE id = ?").run(nowIso, row.id);

    const user: UserRecord = {
      id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      status: row.status,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
    };

    const session: SessionRecord = {
      id: row.id,
      user_id: row.user_id,
      token: row.token,
      duration_days: row.duration_days,
      keep_signed_in: row.keep_signed_in,
      created_at: row.created_at,
      expires_at: row.expires_at,
      last_active_at: nowIso,
    };

    return { valid: true, user, session };
  }

  /**
   * Destroys a session on logout or expiration.
   */
  destroySession(token: string): void {
    if (!token) return;
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  /**
   * Destroys all sessions for a user (e.g. during password reset or global logout).
   */
  destroyAllUserSessions(userId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  /**
   * Switches account to target user ID: destroys current session token,
   * creates new session for target user with their preferred duration.
   */
  switchAccount(currentToken: string | null, targetUserId: string): SessionRecord {
    if (currentToken) {
      this.destroySession(currentToken);
    }

    // Retrieve target user preference for duration
    const pref = this.db.prepare("SELECT session_duration_days FROM user_preferences WHERE user_id = ?").get(targetUserId) as
      | { session_duration_days: number }
      | undefined;

    const duration = pref?.session_duration_days ?? 30;
    return this.createSession(targetUserId, duration, true);
  }

  /**
   * Verifies that an operation is authorized strictly within the user's isolated account.
   */
  assertAccountOwnership(sessionToken: string, requestedUserId: string): void {
    const val = this.validateSession(sessionToken);
    if (!val.valid || !val.user) {
      throw new Error("Unauthorized: Invalid or expired session");
    }
    if (val.user.id !== requestedUserId) {
      throw new Error("Security Violation: Access denied across local account boundaries");
    }
  }
}
