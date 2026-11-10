import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  validateIdentityMutationOrigin: vi.fn(() => null),
  validateIdentityMutationRequest: vi.fn(() => null),
  validateIdentityImageUploadRequest: vi.fn(() => null),
  userHasPermission: vi.fn(),
  userHasScopedPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  productMediaFindFirst: vi.fn(),
  deleteProductImage: vi.fn(),
  verifyDeleteToken: vi.fn(),
  createDeleteToken: vi.fn(),
  getNextImgurClientId: vi.fn(),
  consumeAuthenticatedActionAttempt: vi.fn(),
  storeFindFirst: vi.fn(),
  storeMediaAssetDeleteMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  requireCurrentSession: mocks.requireCurrentSession
}));
vi.mock("@/server/identity/login-throttle", () => ({ consumeAuthenticatedActionAttempt: mocks.consumeAuthenticatedActionAttempt }));
vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationOrigin: mocks.validateIdentityMutationOrigin,
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest,
  validateIdentityImageUploadRequest: mocks.validateIdentityImageUploadRequest
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: mocks.userHasPermission,
  userHasScopedPermission: mocks.userHasScopedPermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    store: { findUnique: mocks.storeFindUnique, findFirst: mocks.storeFindFirst },
    storeMediaAsset: { deleteMany: mocks.storeMediaAssetDeleteMany },
    productMedia: { findFirst: mocks.productMediaFindFirst }
  }
}));
vi.mock("@/server/media/product-image-deletion", () => ({ deleteProductImage: mocks.deleteProductImage }));
vi.mock("@/server/media/temporary-product-image-token", () => ({
  createTemporaryProductImageDeleteToken: mocks.createDeleteToken,
  verifyTemporaryProductImageDeleteToken: mocks.verifyDeleteToken
}));
vi.mock("@/server/media/imgur-client-manager", () => ({ getNextImgurClientId: mocks.getNextImgurClientId }));

import { DELETE } from "@/app/api/seller/products/media/route";

function request(body: unknown) {
  return new Request("https://example.test/api/seller/products/media", {
    method: "DELETE",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(body)
  });
}

describe("seller temporary product image deletion API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.consumeAuthenticatedActionAttempt.mockResolvedValue(false);
    mocks.storeFindFirst.mockResolvedValue(null);
    mocks.storeMediaAssetDeleteMany.mockResolvedValue({ count: 1 });
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }
    });
    mocks.productMediaFindFirst.mockResolvedValue(null);
    mocks.verifyDeleteToken.mockReturnValue("imgur:delete-hash-123");
    mocks.deleteProductImage.mockResolvedValue("deleted");
  });

  it("deletes a valid, unattached upload only for the owning store", async () => {
    const response = await DELETE(request({ storeId: "store-1", deleteToken: "valid-temporary-token" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, deleted: true });
    expect(mocks.verifyDeleteToken).toHaveBeenCalledWith("valid-temporary-token", "store-1");
    expect(mocks.deleteProductImage).toHaveBeenCalledWith("imgur:delete-hash-123");
  });

  it("refuses to delete an image that is already attached to a product", async () => {
    mocks.productMediaFindFirst.mockResolvedValueOnce({ id: "media-1" });
    const response = await DELETE(request({ storeId: "store-1", deleteToken: "valid-temporary-token" }));
    expect(response.status).toBe(409);
    expect(mocks.deleteProductImage).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired tokens before contacting the provider", async () => {
    mocks.verifyDeleteToken.mockReturnValueOnce(null);
    const response = await DELETE(request({ storeId: "store-1", deleteToken: "expired-temporary-image-token" }));
    expect(response.status).toBe(403);
    expect(mocks.deleteProductImage).not.toHaveBeenCalled();
  });

  it("denies a user who does not own or have scoped access to the store", async () => {
    mocks.storeFindUnique.mockResolvedValueOnce({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "another-seller" }
    });
    mocks.userHasScopedPermission.mockResolvedValueOnce(false);
    mocks.userHasPermission.mockResolvedValueOnce(false);
    const response = await DELETE(request({ storeId: "store-1", deleteToken: "valid-temporary-token" }));
    expect(response.status).toBe(403);
    expect(mocks.deleteProductImage).not.toHaveBeenCalled();
  });
});
