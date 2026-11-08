import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateIdentityMutationRequest: vi.fn(),
  updateStoreShippingRate: vi.fn()
}));

vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest
}));
vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/server/shipping/shipping", () => ({
  updateStoreShippingRate: mocks.updateStoreShippingRate
}));

import { PATCH } from "@/app/api/seller/shipping-rates/[id]/route";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/current-session";

describe("PATCH /api/seller/shipping-rates/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateIdentityMutationRequest.mockReturnValue(null);
    mocks.updateStoreShippingRate.mockResolvedValue({ id: "rate-1", amountMinor: "799" });
  });

  it("updates a shipping rate through the store-scoped service", async () => {
    const response = await PATCH(new Request("https://mtjr.test/api/seller/shipping-rates/rate-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeId: "store-1" })
    }), { params: Promise.resolve({ id: "rate-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "rate-1", amountMinor: "799" });
    expect(mocks.updateStoreShippingRate).toHaveBeenCalledWith("rate-1", { storeId: "store-1" });
  });

  it("rejects invalid JSON before calling the service", async () => {
    const response = await PATCH(new Request("https://mtjr.test/api/seller/shipping-rates/rate-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: "{"
    }), { params: Promise.resolve({ id: "rate-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.updateStoreShippingRate).not.toHaveBeenCalled();
  });

  it("maps authentication and permission errors to 401 and 403", async () => {
    mocks.updateStoreShippingRate.mockRejectedValueOnce(new AuthenticationRequiredError());
    const unauthenticated = await PATCH(new Request("https://mtjr.test/api/seller/shipping-rates/rate-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: "{}"
    }), { params: Promise.resolve({ id: "rate-1" }) });
    expect(unauthenticated.status).toBe(401);

    mocks.updateStoreShippingRate.mockRejectedValueOnce(new PermissionDeniedError());
    const forbidden = await PATCH(new Request("https://mtjr.test/api/seller/shipping-rates/rate-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: "{}"
    }), { params: Promise.resolve({ id: "rate-1" }) });
    expect(forbidden.status).toBe(403);
  });
});
