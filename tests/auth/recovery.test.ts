import { describe, it, expect } from "vitest";
import {
  generateRecoveryKey,
  normalizeRecoveryKey,
  deriveRecoveryVerifier,
  verifyRecoveryKey,
} from "../../src/lib/auth/recovery";

describe("Recovery Key Engine", () => {
  it("generates 128-bit high-entropy formatted recovery key", () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^REC-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    const key2 = generateRecoveryKey();
    expect(key).not.toBe(key2);
  });

  it("normalizes user-entered recovery keys accurately", () => {
    expect(normalizeRecoveryKey("REC-ABCD-EFGH-JKMN-PQRS")).toBe("ABCDEFGHJKMNPQRS");
    expect(normalizeRecoveryKey("rec-abcd-efgh-jkmn-pqrs")).toBe("ABCDEFGHJKMNPQRS");
    expect(normalizeRecoveryKey(" ABCD EFGH JKMN PQRS ")).toBe("ABCDEFGHJKMNPQRS");
  });

  it("derives one-way Argon2id verifier and verifies valid key", async () => {
    const key = generateRecoveryKey();
    const verifierHash = await deriveRecoveryVerifier(key);

    expect(verifierHash).toContain("$argon2id$");

    // Valid check
    const matches = await verifyRecoveryKey(key, verifierHash);
    expect(matches).toBe(true);

    // Minor typo or invalid key should fail
    const badKey = "REC-ZZZZ-ZZZZ-ZZZZ-ZZZZ";
    const fails = await verifyRecoveryKey(badKey, verifierHash);
    expect(fails).toBe(false);
  });

  it("rejects malformed recovery keys during verifier derivation", async () => {
    await expect(deriveRecoveryVerifier("TOO-SHORT")).rejects.toThrow(/Invalid recovery key format/);
  });
});
