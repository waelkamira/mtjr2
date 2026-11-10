import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStoreShippingRate: vi.fn(),
  listStoreShippingRates: vi.fn(),
  validateIdentityMutationRequest: vi.fn(() => null)
}));

vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest
}));
vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/server/shipping/shipping", () => ({
  createStoreShippingRate: mocks.createStoreShippingRate,
  listStoreShippingRates: mocks.listStoreShippingRates
}));

import { GET, POST } from "@/app/api/seller/shipping-rates/route";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/current-session";

describe("seller shipping rates API error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 only for a typed permission denial on GET", async () => {
    mocks.listStoreShippingRates.mockRejectedValueOnce(new PermissionDeniedError("denied"));
    const denied = await GET(new Request("https://example.test/api/seller/shipping-rates?storeId=s1"));
    expect(denied.status).toBe(403);

    mocks.listStoreShippingRates.mockRejectedValueOnce(new Error("database unavailable"));
    const failed = await GET(new Request("https://example.test/api/seller/shipping-rates?storeId=s1"));
    expect(failed.status).toBe(500);
  });

  it("preserves authentication and validation status codes on GET", async () => {
    mocks.listStoreShippingRates.mockRejectedValueOnce(new AuthenticationRequiredError());
    const unauthenticated = await GET(new Request("https://example.test/api/seller/shipping-rates?storeId=s1"));
    expect(unauthenticated.status).toBe(401);

    const invalid = await GET(new Request("https://example.test/api/seller/shipping-rates"));
    expect(invalid.status).toBe(400);
  });

  it("returns 500 for unexpected POST failures instead of disguising them as client errors", async () => {
    mocks.createStoreShippingRate.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(new Request("https://example.test/api/seller/shipping-rates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId: "s1" })
    }));
    expect(response.status).toBe(500);
  });
});
