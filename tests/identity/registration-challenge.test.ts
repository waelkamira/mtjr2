import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters" }
}));

import {
  createRegistrationChallengeCookie,
  isValidRegistrationChallengeCookie
} from "@/server/identity/registration-challenge";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("signed registration challenge cookie", () => {
  it("accepts a valid short-lived challenge and rejects tampering or expiry", () => {
    const cookie = createRegistrationChallengeCookie(now);
    expect(isValidRegistrationChallengeCookie(cookie, now)).toBe(true);
    expect(isValidRegistrationChallengeCookie(`${cookie}x`, now)).toBe(false);
    expect(isValidRegistrationChallengeCookie(cookie, new Date(now.getTime() + 6 * 60 * 1000))).toBe(false);
    expect(isValidRegistrationChallengeCookie(undefined, now)).toBe(false);
  });
});
