import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasPermission: vi.fn(),
  userHasScopedPermission: vi.fn(),
  warehouseFindUnique: vi.fn(),
  staffFindFirst: vi.fn(),
  requestFindUnique: vi.fn(),
  itemFindMany: vi.fn(),
  inventoryUpsert: vi.fn(),
  movementCreate: vi.fn(),
  itemUpdateMany: vi.fn(),
  requestUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: mocks.userHasPermission,
  userHasScopedPermission: mocks.userHasScopedPermission
}));

import { receiveSellerReturnItems } from "@/server/returns/return-receipt";

describe("seller return receipt into inventory quarantine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-a" });
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.warehouseFindUnique.mockResolvedValue({
      id: "warehouse-a", storeId: "store-a", isActive: true,
      store: { id: "store-a", status: "ACTIVE", seller: { ownerId: "seller-a", status: "ACTIVE" } }
    });
    mocks.staffFindFirst.mockResolvedValue(null);
    mocks.requestFindUnique.mockResolvedValue({ id: "return-1", returnNumber: "RET-1", status: "APPROVED" });
    mocks.itemFindMany
      .mockResolvedValueOnce([
        { id: "return-item-1", quantity: 2, orderItem: { variantId: "variant-1", sku: "SKU-1" } },
        { id: "return-item-2", quantity: 1, orderItem: { variantId: "variant-2", sku: "SKU-2" } }
      ])
      .mockResolvedValueOnce([{ status: "RECEIVED" }, { status: "RECEIVED" }]);
    mocks.inventoryUpsert.mockImplementation(async ({ where }) => ({ id: "inventory-" + where.warehouseId_variantId.variantId }));
    mocks.movementCreate.mockImplementation(async ({ data }) => ({ id: data.idempotencyKey }));
    mocks.itemUpdateMany.mockResolvedValue({ count: 2 });
    mocks.requestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    const tx = {
      warehouse: { findUnique: mocks.warehouseFindUnique },
      sellerStaff: { findFirst: mocks.staffFindFirst },
      returnRequest: { findUnique: mocks.requestFindUnique, updateMany: mocks.requestUpdateMany },
      returnItem: { findMany: mocks.itemFindMany, updateMany: mocks.itemUpdateMany },
      inventory: { upsert: mocks.inventoryUpsert },
      inventoryMovement: { create: mocks.movementCreate },
      auditLog: { create: mocks.auditCreate }
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("records approved lines as quarantined, never sellable, and advances the request", async () => {
    const result = await receiveSellerReturnItems("return-1", {
      storeId: "store-a", warehouseId: "warehouse-a", note: "Package inspected"
    }, new Date("2026-11-05T00:00:00Z"));

    expect(result).toMatchObject({ receivedItems: 2, quarantinedQuantity: 3, alreadyApplied: false });
    expect(mocks.inventoryUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.inventoryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { warehouseId: "warehouse-a", variantId: "variant-1", quantityOnHand: 0, quantityQuarantined: 2 },
      update: { quantityQuarantined: { increment: 2 } }
    }));
    expect(mocks.movementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "RETURN_RECEIPT", quantityDelta: 0, quarantinedDelta: 2,
        referenceType: "RETURN_ITEM", referenceId: "return-item-1",
        idempotencyKey: "return-receipt:return-item-1"
      })
    }));
    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { returnRequestId: "return-1", status: "APPROVED", orderItem: { vendorOrder: { storeId: "store-a" } } },
      data: expect.objectContaining({ status: "RECEIVED", reviewedById: "seller-a" })
    }));
    expect(mocks.requestUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "RECEIVED" })
    }));
  });

  it("denies a seller from receiving another store's items", async () => {
    mocks.warehouseFindUnique.mockResolvedValue({
      id: "warehouse-b", storeId: "store-b", isActive: true,
      store: { id: "store-b", status: "ACTIVE", seller: { ownerId: "seller-b", status: "ACTIVE" } }
    });
    await expect(receiveSellerReturnItems("return-1", {
      storeId: "store-b", warehouseId: "warehouse-b"
    })).rejects.toThrow("Permission denied.");
    expect(mocks.itemFindMany).not.toHaveBeenCalled();
    expect(mocks.inventoryUpsert).not.toHaveBeenCalled();
  });

  it("does not receive a line without a product variant", async () => {
    mocks.itemFindMany.mockReset().mockResolvedValueOnce([
      { id: "return-item-1", quantity: 1, orderItem: { variantId: null, sku: "LEGACY-SKU" } }
    ]);
    await expect(receiveSellerReturnItems("return-1", {
      storeId: "store-a", warehouseId: "warehouse-a"
    })).rejects.toThrow("no active product variant");
    expect(mocks.inventoryUpsert).not.toHaveBeenCalled();
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
  });

  it("treats a completed store receipt as an idempotent retry", async () => {
    mocks.itemFindMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([
      { status: "RECEIVED" }, { status: "REJECTED" }
    ]);
    const result = await receiveSellerReturnItems("return-1", {
      storeId: "store-a", warehouseId: "warehouse-a"
    });
    expect(result.alreadyApplied).toBe(true);
    expect(mocks.inventoryUpsert).not.toHaveBeenCalled();
    expect(mocks.movementCreate).not.toHaveBeenCalled();
  });
});
