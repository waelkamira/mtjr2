import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  sellerCount: vi.fn(),
  sellerFindMany: vi.fn(),
  storeFindUnique: vi.fn(),
  storeUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    seller: { count: mocks.sellerCount, findMany: mocks.sellerFindMany },
    store: { findUnique: mocks.storeFindUnique },
    $transaction: mocks.transaction
  }
}));

import { changeAdminStoreStatus, listAdminSellers } from "@/server/admin/sellers";

describe("admin seller and store operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.sellerCount.mockResolvedValue(1);
    mocks.sellerFindMany.mockResolvedValue([{
      id: "seller-1", status: "ACTIVE", legalName: "Seller Inc.", displayName: "Seller",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      owner: { id: "owner-1", email: "owner@example.test", displayName: "Owner", status: "ACTIVE" },
      store: { id: "store-1", name: "Store", slug: "store", status: "ACTIVE", createdAt: new Date("2026-01-01T00:00:00.000Z") }
    }]);
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      store: { findUnique: mocks.storeFindUnique, updateMany: mocks.storeUpdateMany },
      auditLog: { create: mocks.auditCreate }
    }));
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", sellerId: "seller-1", seller: { status: "ACTIVE" }
    });
    mocks.storeUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("searches and paginates sellers behind users:manage", async () => {
    const result = await listAdminSellers({ q: "Owner", status: "ACTIVE", page: "2", limit: "10" });

    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage", now: expect.any(Date) });
    expect(mocks.sellerFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({ status: "ACTIVE" })
    }));
    expect(result).toMatchObject({ page: 2, limit: 10, total: 1, items: [{ storeCount: 1 }] });
  });

  it("suspends a store with an audit record and rechecks the current state", async () => {
    const now = new Date("2026-11-05T00:00:00Z");
    const result = await changeAdminStoreStatus("store-1", {
      status: "SUSPENDED",
      reason: "Policy violation"
    }, now);

    expect(mocks.storeUpdateMany).toHaveBeenCalledWith({
      where: { id: "store-1", status: "ACTIVE" },
      data: { status: "SUSPENDED" }
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "store.suspended",
        resourceId: "store-1",
        scopeType: "STORE",
        scopeId: "store-1",
        occurredAt: now,
        metadata: expect.objectContaining({ reason: "Policy violation", previousStatus: "ACTIVE" })
      })
    }));
    expect(result).toMatchObject({ previousStatus: "ACTIVE", status: "SUSPENDED" });
  });

  it("rejects reactivation when the seller is not active", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "SUSPENDED", sellerId: "seller-1", seller: { status: "SUSPENDED" }
    });

    await expect(changeAdminStoreStatus("store-1", {
      status: "ACTIVE",
      reason: "Review completed"
    })).rejects.toThrow("seller is not active");
    expect(mocks.storeUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
