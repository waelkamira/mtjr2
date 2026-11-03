import { describe, expect, it } from "vitest";
import { resolveTrustedClientIp } from "../../src/server/identity/trusted-client-ip";

describe("resolveTrustedClientIp", () => {
  it("fails closed when no trusted proxy header is configured", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });
    expect(resolveTrustedClientIp(headers, undefined)).toBeNull();
  });

  it("does not fall back to a client-controlled forwarding header", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10",
      "cf-connecting-ip": ""
    });
    expect(resolveTrustedClientIp(headers, "cf-connecting-ip")).toBeNull();
  });

  it("accepts a valid Cloudflare client IP", () => {
    const headers = new Headers({ "cf-connecting-ip": "2001:db8::1" });
    expect(resolveTrustedClientIp(headers, "cf-connecting-ip")).toBe("2001:db8::1");
  });

  it("uses the first address from the trusted Vercel proxy chain", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.2"
    });
    expect(resolveTrustedClientIp(headers, "x-vercel-forwarded-for")).toBe("203.0.113.10");
  });

  it("rejects malformed or ambiguous proxy values", () => {
    expect(
      resolveTrustedClientIp(
        new Headers({ "cf-connecting-ip": "203.0.113.10, 198.51.100.2" }),
        "cf-connecting-ip"
      )
    ).toBeNull();
    expect(
      resolveTrustedClientIp(
        new Headers({ "x-vercel-forwarded-for": "not-an-ip, 10.0.0.2" }),
        "x-vercel-forwarded-for"
      )
    ).toBeNull();
  });
});
