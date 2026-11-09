import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  warehouseFindUnique: vi.fn(),
  productVariantFindFirst: vi.fn(),
  productVariantFindMany: vi.fn(),
  inventoryFindUnique: vi.fn(),
  inventoryCreate: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  inventoryMovementFindUnique: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  auditCreate: vi.fn(),
  stockTransferFindUnique: vi.fn(),
  stockTransferCreate: vi.fn(),
  stockTransferUpdateMany: vi.fn()
}));

const tx = {
  warehouse: { findUnique: mocks.warehouseFindUnique },
  productVariant: { findFirst: mocks.productVariantFindFirst, findMany: mocks.productVariantFindMany },
  inventory: { findUnique: mocks.inventoryFindUnique, create: mocks.inventoryCreate, updateMany: mocks.inventoryUpdateMany },
  inventoryMovement: { findUnique: mocks.inventoryMovementFindUnique, create: mocks.inventoryMovementCreate },
  auditLog: { create: mocks.auditCreate },
  stockTransfer: { findUnique: mocks.stockTransferFindUnique, create: mocks.stockTransferCreate, updateMany: mocks.stockTransferUpdateMany }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) }
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasScopedPermission: mocks.userHasScopedPermission,
  userHasPermission: mocks.userHasPermission
}));

import { adjustInventory, createStockTransfer, shipStockTransfer } from "@/server/inventory/stock";

describe("seller inventory operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.warehouseFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id, storeId: "store-1", isActive: true,
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
    }));
    mocks.productVariantFindFirst.mockResolvedValue({ id: "variant-1" });
    mocks.inventoryMovementFindUnique.mockResolvedValue(null);
    mocks.inventoryFindUnique.mockResolvedValue({ id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 2 });
    mocks.inventoryMovementCreate.mockResolvedValue({ id: "movement-1" });
    mocks.inventoryCreate.mockResolvedValue({ id: "inventory-1", quantityOnHand: 10, quantityReserved: 0, quantityQuarantined: 0 });
    mocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("rejects a negative adjustment that would consume reserved stock", async () => {
    mocks.inventoryFindUnique.mockResolvedValue({
      id: "inventory-1", quantityOnHand: 10, quantityReserved: 4, quantityQuarantined: 2
    });
    await expect(adjustInventory({
      warehouseId: "warehouse-1", variantId: "variant-1",
      quantityDelta: -7, idempotencyKey: "adjustment-key-0001"
    })).rejects.toThrow("below zero");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it("applies a stock adjustment once and records movement plus audit", async () => {
    mocks.inventoryFindUnique.mockResolvedValue({
      id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 2
    });
    const result = await adjustInventory({
      warehouseId: "warehouse-1", variantId: "variant-1",
      quantityDelta: 5, idempotencyKey: "adjustment-key-0002"
    });
    expect(result).toEqual({ movementId: "movement-1", inventoryId: "inventory-1", alreadyApplied: false });
    expect(mocks.inventoryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 2 },
      data: { quantityOnHand: { increment: 5 } }
    }));
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("returns the prior movement for an identical idempotency key", async () => {
    mocks.inventoryMovementFindUnique.mockResolvedValue({
      id: "movement-existing", inventoryId: "inventory-1", quantityDelta: 5, type: "ADJUSTMENT"
    });
    const result = await adjustInventory({
      warehouseId: "warehouse-1", variantId: "variant-1",
      quantityDelta: 5, idempotencyKey: "adjustment-key-0003"
    });
    expect(result.alreadyApplied).toBe(true);
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects reuse of an adjustment key for a different inventory row", async () => {
    mocks.inventoryMovementFindUnique.mockResolvedValue({
      id: "movement-existing", inventoryId: "inventory-other", quantityDelta: 5, type: "ADJUSTMENT"
    });
    await expect(adjustInventory({
      warehouseId: "warehouse-1", variantId: "variant-1",
      quantityDelta: 5, idempotencyKey: "adjustment-key-0004"
    })).rejects.toThrow("different inventory operation");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
  });

  it("replays a stock transfer idempotently without creating a duplicate", async () => {
    mocks.stockTransferFindUnique.mockResolvedValue({
      id: "transfer-existing", status: "DRAFT",
      sourceWarehouseId: "warehouse-1", destinationWarehouseId: "warehouse-2",
      items: [{ variantId: "variant-1", quantity: 3 }]
    });
    const result = await createStockTransfer({
      sourceWarehouseId: "warehouse-1", destinationWarehouseId: "warehouse-2",
      idempotencyKey: "stock-transfer-key-0001",
      items: [{ variantId: "variant-1", quantity: 3 }]
    });
    expect(result).toEqual({
      id: "transfer-existing", status: "DRAFT",
      sourceWarehouseId: "warehouse-1", destinationWarehouseId: "warehouse-2",
      alreadyApplied: true
    });
    expect(mocks.stockTransferCreate).not.toHaveBeenCalled();
    expect(mocks.productVariantFindMany).not.toHaveBeenCalled();
  });

  it("does not ship a transfer when available stock is insufficient", async () => {
    mocks.stockTransferFindUnique.mockResolvedValue({
      id: "transfer-1", storeId: "store-1", status: "DRAFT",
      sourceWarehouseId: "warehouse-1", destinationWarehouseId: "warehouse-2",
      items: [{ variantId: "variant-1", quantity: 8 }]
    });
    mocks.warehouseFindUnique
      .mockResolvedValueOnce({
        id: "warehouse-1", storeId: "store-1", isActive: true,
        store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
      })
      .mockResolvedValueOnce({
        id: "warehouse-2", storeId: "store-1", isActive: true,
        store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
      });
    mocks.inventoryFindUnique.mockResolvedValue({
      id: "inventory-1", quantityOnHand: 10, quantityReserved: 4, quantityQuarantined: 2
    });
    await expect(shipStockTransfer("transfer-1")).rejects.toThrow("Insufficient available stock");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.stockTransferUpdateMany).not.toHaveBeenCalled();
  });
});
