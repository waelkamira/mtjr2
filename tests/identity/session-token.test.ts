import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken
} from "../../src/server/identity/session";

describe("session token primitives", () => {
  it("generates opaque tokens with sufficient entropy and URL-safe encoding", () => {
    const token = generateSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).toHaveLength(43);
  });

  it("generates a different token for each call", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it("hashes tokens deterministically to a fixed-length digest", () => {
    const token = "a".repeat(43);

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("produces different digests for different tokens", () => {
    expect(hashSessionToken("a".repeat(43))).not.toBe(
      hashSessionToken("b".repeat(43))
    );
  });
});
