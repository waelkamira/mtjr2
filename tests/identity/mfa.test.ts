import { describe, expect, it } from "vitest";
import {
  decodeBase32, decryptMfaSecret, encodeBase32, encryptMfaSecret,
  findMatchingTotpStep, generateTotpCode
} from "../../src/server/identity/mfa";

describe("MFA cryptography and TOTP policy", () => {
  it("round-trips Base32 secrets", () => {
    const bytes = Buffer.from("matjar-totp-secret");
    expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
  });

  it("accepts a valid TOTP within the clock window", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const step = 60_000_000;
    const now = new Date(step * 30_000);
    const code = generateTotpCode(secret, step);
    expect(findMatchingTotpStep(secret, code, now, null)).toBe(step);
  });

  it("rejects replayed TOTP steps", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const step = 60_000_000;
    const now = new Date(step * 30_000);
    const code = generateTotpCode(secret, step);
    expect(findMatchingTotpStep(secret, code, now, step)).toBeNull();
  });

  it("encrypts authenticator secrets with authenticated encryption", () => {
    const key = Buffer.alloc(32, 7);
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptMfaSecret(secret, key);
    expect(decryptMfaSecret(encrypted, key)).toBe(secret);
    expect(() => decryptMfaSecret(encrypted, Buffer.alloc(32, 8))).toThrow();
  });
});
