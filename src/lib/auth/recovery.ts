import { argon2id, argon2Verify } from "hash-wasm";
import { ARGON2_CONFIG } from "./crypto";

// Unambiguous base32 characters (excluding 0, O, 1, I, L)
const RECOVERY_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generates a high-entropy 128-bit recovery key formatted as REC-XXXX-XXXX-XXXX-XXXX.
 */
export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (let i = 0; i < 16; i++) {
    const idx = bytes[i] % RECOVERY_CHARS.length;
    raw += RECOVERY_CHARS[idx];
  }

  // Format into 4 groups of 4 characters prefixed with REC-
  const g1 = raw.slice(0, 4);
  const g2 = raw.slice(4, 8);
  const g3 = raw.slice(8, 12);
  const g4 = raw.slice(12, 16);

  return `REC-${g1}-${g2}-${g3}-${g4}`;
}

/**
 * Normalizes a recovery key by removing prefixes, dashes, whitespace, and upper-casing.
 */
export function normalizeRecoveryKey(key: string): string {
  return key
    .toUpperCase()
    .replace(/^REC-?/, "")
    .replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "");
}

/**
 * Computes a secure one-way Argon2id hash of the normalized recovery key for storage.
 * The raw recovery key is never stored in plaintext on disk.
 */
export async function deriveRecoveryVerifier(rawKey: string): Promise<string> {
  const normalized = normalizeRecoveryKey(rawKey);
  if (normalized.length !== 16) {
    throw new Error("Invalid recovery key format: must contain 16 alphanumeric characters");
  }
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  return argon2id({
    password: normalized,
    salt,
    ...ARGON2_CONFIG,
  });
}

/**
 * Validates a user-supplied recovery key against the stored Argon2id verifier.
 */
export async function verifyRecoveryKey(suppliedKey: string, storedVerifierHash: string): Promise<boolean> {
  const normalized = normalizeRecoveryKey(suppliedKey);
  if (normalized.length !== 16) {
    return false;
  }
  try {
    return await argon2Verify({
      password: normalized,
      hash: storedVerifierHash,
    });
  } catch {
    return false;
  }
}
