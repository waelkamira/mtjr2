import { describe, expect, it } from "vitest";
import {
  isMfaVerificationFresh,
  matchingTotpStep
} from "../../src/server/identity/mfa";

describe("TOTP policy", () => {
  it("accepts an RFC 6238 SHA-1 test vector within the current time step", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(matchingTotpStep(secret, "287082", new Date(59_000), null)).toBe(1);
  });

  it("rejects malformed, incorrect, and replayed authenticator codes", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(matchingTotpStep(secret, "28708", new Date(59_000), null)).toBeNull();
    expect(matchingTotpStep(secret, "000000", new Date(59_000), null)).toBeNull();
    expect(matchingTotpStep(secret, "287082", new Date(59_000), BigInt(1))).toBeNull();
  });
});

describe("MFA session freshness", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  it("expires MFA assurance after twelve hours", () => {
    expect(isMfaVerificationFresh(new Date(now.getTime() - 11 * 60 * 60 * 1000), now)).toBe(true);
    expect(isMfaVerificationFresh(new Date(now.getTime() - 12 * 60 * 60 * 1000), now)).toBe(false);
    expect(isMfaVerificationFresh(null, now)).toBe(false);
  });
});
