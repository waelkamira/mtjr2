import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasPermission: vi.fn(),
  userHasScopedPermission: vi.fn(),
  storeFindMany: vi.fn(),
  returnFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    store: { findMany: mocks.storeFindMany },
    returnRequest: { findMany: mocks.returnFindMany }
  }
}));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: mocks.userHasPermission,
  userHasScopedPermission: mocks.userHasScopedPermission
}));

import { listSellerReturnRequests } from "@/server/returns/seller-returns";

describe("seller return visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.storeFindMany.mockResolvedValue([
      { id: "store-owned", name: "Owned store", seller: { ownerId: "seller-1", status: "ACTIVE" } },
      { id: "store-delegated", name: "Delegated store", seller: { ownerId: "seller-2", status: "ACTIVE" } },
      { id: "store-inactive", name: "Inactive store", seller: { ownerId: "seller-1", status: "SUSPENDED" } }
    ]);
    mocks.userHasScopedPermission.mockImplementation(async (_userId, request) => request.scope.id === "store-delegated");
    mocks.returnFindMany.mockResolvedValue([{
      id: "return-1",
      returnNumber: "RET-20261104-ABCD1234",
      status: "APPROVED",
      reasonCode: "DAMAGED",
      reasonDetails: "Box was damaged",
      reviewNote: "Approved by platform",
      requestedAt: new Date("2026-11-04T00:00:00.000Z"),
      order: { orderNumber: "ORD-1" },
      items: [
        { id: "return-item-a", status: "REQUESTED", reviewNote: null, quantity: 1, orderItem: { productName: "Product A", sku: "A-1", quantity: 2, vendorOrder: { storeId: "store-owned", store: { name: "Owned store" } } } },
        { id: "return-item-b", status: "REQUESTED", reviewNote: null, quantity: 2, orderItem: { productName: "Product B", sku: "B-1", quantity: 3, vendorOrder: { storeId: "store-delegated", store: { name: "Delegated store" } } } }
      ]
    }]);
  });

  it("filters requests to owned or explicitly authorized stores and separates multi-store requests", async () => {
    const result = await listSellerReturnRequests(new Date("2026-11-04T01:00:00.000Z"));

    expect(mocks.returnFindMany).toHaveBeenCalledOnce();
    expect(mocks.returnFindMany.mock.calls[0][0].where.items.some.orderItem.vendorOrder.storeId.in)
      .toEqual(["store-owned", "store-delegated"]);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.storeId)).toEqual(["store-owned", "store-delegated"]);
    expect(result.items[0].items).toEqual([{ id: "return-item-a", status: "REQUESTED", reviewNote: null, productName: "Product A", sku: "A-1", orderedQuantity: 2, returnQuantity: 1 }]);
    expect(result.items[1].items).toEqual([{ id: "return-item-b", status: "REQUESTED", reviewNote: null, productName: "Product B", sku: "B-1", orderedQuantity: 3, returnQuantity: 2 }]);
  });

  it("does not query or expose returns when the user has no authorized active store", async () => {
    mocks.storeFindMany.mockResolvedValue([
      { id: "store-other", name: "Other store", seller: { ownerId: "seller-2", status: "ACTIVE" } }
    ]);
    mocks.userHasScopedPermission.mockResolvedValue(false);

    await expect(listSellerReturnRequests()).resolves.toEqual({ items: [] });
    expect(mocks.returnFindMany).not.toHaveBeenCalled();
  });
});
