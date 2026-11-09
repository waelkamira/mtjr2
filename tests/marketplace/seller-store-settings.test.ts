import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, StoreStatus } from "@prisma/client";

const {
  requireCurrentSession, userHasScopedPermission, transaction, queryRaw,
  storeFindUnique, storeUpdate, auditCreate
} = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  storeFindUnique: vi.fn(),
  storeUpdate: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission }));
vi.mock("@/server/identity/permission-guard", () => ({
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: transaction } }));

import { PermissionDeniedError } from "@/server/identity/permission-guard";
import {
  SellerStoreSettingsConflictError,
  updateSellerStoreSettings
} from "@/server/marketplace/seller-store-settings";

const draftStore = {
  id: "store-1", sellerId: "seller-1", name: "Original Shop", slug: "original-shop",
  status: StoreStatus.DRAFT, seller: { ownerId: "user-1", status: "ACTIVE" }
};

describe("seller store profile settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({ userId: "user-1" });
    userHasScopedPermission.mockResolvedValue(false);
    storeFindUnique.mockResolvedValue({ id: "store-1" });
    storeUpdate.mockResolvedValue({ id: "store-1", name: "Updated Shop", slug: "updated-shop", status: StoreStatus.DRAFT });
    auditCreate.mockResolvedValue({});
    transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      $queryRaw: queryRaw,
      store: { findUnique: storeFindUnique, update: storeUpdate },
      auditLog: { create: auditCreate }
    }));
  });

  it("updates an owned draft store and writes an audit event atomically", async () => {
    storeFindUnique.mockResolvedValueOnce(draftStore).mockResolvedValueOnce({ id: "store-1" });
    const result = await updateSellerStoreSettings("store-1", { name: "Updated Shop", slug: "updated-shop" });
    expect(result).toMatchObject({ id: "store-1", name: "Updated Shop", slug: "updated-shop" });
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(storeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "store-1" }, data: { name: "Updated Shop", slug: "updated-shop" }
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "store.settings_updated", resourceId: "store-1" })
    }));
  });

  it("does not allow changing an active store URL", async () => {
    storeFindUnique.mockResolvedValueOnce({ ...draftStore, status: StoreStatus.ACTIVE });
    await expect(updateSellerStoreSettings("store-1", { name: "Updated Shop", slug: "updated-shop" }))
      .rejects.toMatchObject({ code: "SLUG_LOCKED" });
    expect(storeUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("requires exact store-scoped permission for non-owners", async () => {
    storeFindUnique.mockResolvedValueOnce({ ...draftStore, seller: { ownerId: "different-user", status: "ACTIVE" } });
    userHasScopedPermission.mockResolvedValue(false);
    await expect(updateSellerStoreSettings("store-1", { name: "Updated Shop", slug: "updated-shop" }))
      .rejects.toBeInstanceOf(PermissionDeniedError);
    expect(storeUpdate).not.toHaveBeenCalled();
  });

  it("rejects a slug already owned by another store", async () => {
    storeFindUnique.mockResolvedValueOnce(draftStore).mockResolvedValueOnce({ id: "other-store" });
    await expect(updateSellerStoreSettings("store-1", { name: "Updated Shop", slug: "updated-shop" }))
      .rejects.toBeInstanceOf(SellerStoreSettingsConflictError);
    expect(storeUpdate).not.toHaveBeenCalled();
  });
});
