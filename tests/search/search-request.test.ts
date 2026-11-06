import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeSearchAttempt: vi.fn(),
  resolveTrustedClientIp: vi.fn()
}));

vi.mock("@/lib/env", () => ({ env: { TRUSTED_PROXY_IP_HEADER: "cf-connecting-ip", NODE_ENV: "production" } }));
vi.mock("@/server/identity/login-throttle", () => ({ consumeSearchAttempt: mocks.consumeSearchAttempt }));
vi.mock("@/server/identity/trusted-client-ip", () => ({ resolveTrustedClientIp: mocks.resolveTrustedClientIp }));

import { enforcePublicSearchBudget } from "@/server/search/search-request";

describe("public search abuse protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTrustedClientIp.mockReturnValue("203.0.113.10");
    mocks.consumeSearchAttempt.mockResolvedValue({ blocked: false });
  });

  it("requires a trusted client address", async () => {
    mocks.resolveTrustedClientIp.mockReturnValue(null);
    const response = await enforcePublicSearchBudget(new Request("https://example.test/api/search"));
    expect(response?.status).toBe(503);
    expect(mocks.consumeSearchAttempt).not.toHaveBeenCalled();
  });

  it("returns retry guidance when the persistent search budget is exhausted", async () => {
    mocks.consumeSearchAttempt.mockResolvedValue({ blocked: true });
    const response = await enforcePublicSearchBudget(new Request("https://example.test/api/search"));
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("900");
  });

  it("fails closed when the persistent rate limiter is unavailable", async () => {
    mocks.consumeSearchAttempt.mockRejectedValue(new Error("database unavailable"));
    const response = await enforcePublicSearchBudget(new Request("https://example.test/api/search"));
    expect(response?.status).toBe(503);
  });
});
