import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSellerStore: vi.fn(),
  getSellerWorkspace: vi.fn(),
  validateIdentityMutationRequest: vi.fn()
}));

vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest
}));
vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class extends Error {}
}));
vi.mock("@/server/marketplace/seller-application", () => ({
  createSellerStore: mocks.createSellerStore,
  getSellerWorkspace: mocks.getSellerWorkspace
}));

import { POST } from "@/app/api/seller/stores/route";

describe("POST /api/seller/stores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateIdentityMutationRequest.mockReturnValue(null);
  });

  function request() {
    return new Request("http://localhost/api/seller/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Shop", slug: "shop", marketIds: ["market-1"] })
    });
  }

  it("returns 201 when creating a store", async () => {
    mocks.createSellerStore.mockResolvedValue({
      id: "store-1", name: "Shop", slug: "shop", status: "DRAFT", alreadyCreated: false
    });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: "store-1", alreadyCreated: false });
  });

  it("returns 200 when replaying the same store creation", async () => {
    mocks.createSellerStore.mockResolvedValue({
      id: "store-1", name: "Shop", slug: "shop", status: "DRAFT", alreadyCreated: true
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "store-1", alreadyCreated: true });
  });

  it("does not call the service when request security rejects the mutation", async () => {
    mocks.validateIdentityMutationRequest.mockReturnValue(Response.json({ error: "Request rejected." }, { status: 403 }));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.createSellerStore).not.toHaveBeenCalled();
  });
});
