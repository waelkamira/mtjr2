import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  warehouseFindUnique: vi.fn(),
  warehouseUpdate: vi.fn(),
  inventoryFindFirst: vi.fn(),
  stockTransferFindFirst: vi.fn(),
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
  stockTransferUpdateMany: vi.fn(),
  storeFindUnique: vi.fn(),
  inventoryMovementFindMany: vi.fn()
}));

const tx = {
  warehouse: { findUnique: mocks.warehouseFindUnique, update: mocks.warehouseUpdate },
  productVariant: { findFirst: mocks.productVariantFindFirst, findMany: mocks.productVariantFindMany },
  inventory: { findUnique: mocks.inventoryFindUnique, findFirst: mocks.inventoryFindFirst, create: mocks.inventoryCreate, updateMany: mocks.inventoryUpdateMany },
  inventoryMovement: { findUnique: mocks.inventoryMovementFindUnique, create: mocks.inventoryMovementCreate, findMany: mocks.inventoryMovementFindMany },
  auditLog: { create: mocks.auditCreate },
  stockTransfer: { findUnique: mocks.stockTransferFindUnique, findFirst: mocks.stockTransferFindFirst, create: mocks.stockTransferCreate, updateMany: mocks.stockTransferUpdateMany }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)), store: { findUnique: mocks.storeFindUnique }, inventoryMovement: { findMany: mocks.inventoryMovementFindMany } }
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasScopedPermission: mocks.userHasScopedPermission,
  userHasPermission: mocks.userHasPermission
}));

import { adjustInventory, createStockTransfer, shipStockTransfer, listStoreInventoryMovements, decideQuarantinedStock, updateWarehouse } from "@/server/inventory/stock";

describe("seller inventory operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.warehouseUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, storeId: "store-1", code: String(data.code ?? "MAIN"), name: String(data.name ?? "Main"), isActive: Boolean(data.isActive ?? true) }));
    mocks.inventoryFindFirst.mockResolvedValue(null);
    mocks.stockTransferFindFirst.mockResolvedValue(null);
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
    mocks.storeFindUnique.mockResolvedValue({ id: "store-1", seller: { ownerId: "owner-1", status: "ACTIVE" } });
    mocks.inventoryMovementFindMany.mockResolvedValue([]);
  });


  it("updates warehouse details and writes a scoped audit record", async () => {
    mocks.warehouseFindUnique.mockResolvedValue({
      id: "warehouse-1", storeId: "store-1", isActive: true,
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
    });
    await expect(updateWarehouse("warehouse-1", { name: "Central depot", code: "CENTRAL" })).resolves.toMatchObject({ id: "warehouse-1", name: "Central depot", code: "CENTRAL" });
    expect(mocks.warehouseUpdate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "inventory.warehouse.updated", scopeId: "store-1" }) }));
  });

  it("blocks warehouse deactivation while stock remains", async () => {
    mocks.warehouseFindUnique.mockResolvedValue({
      id: "warehouse-1", storeId: "store-1", isActive: true,
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
    });
    mocks.inventoryFindFirst.mockResolvedValue({ id: "inventory-1" });
    await expect(updateWarehouse("warehouse-1", { isActive: false })).rejects.toThrow("Move or reconcile all stock");
    expect(mocks.warehouseUpdate).not.toHaveBeenCalled();
  });

  it("deactivates an empty warehouse only when no transfer is pending", async () => {
    mocks.warehouseFindUnique.mockResolvedValue({
      id: "warehouse-1", storeId: "store-1", isActive: true,
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
    });
    await expect(updateWarehouse("warehouse-1", { isActive: false })).resolves.toMatchObject({ isActive: false });
    expect(mocks.inventoryFindFirst).toHaveBeenCalledOnce();
    expect(mocks.stockTransferFindFirst).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("lists only the requested store's latest ledger movements", async () => {
    const entries = [{ id: "movement-1", quantityDelta: -2 }];
    mocks.inventoryMovementFindMany.mockResolvedValue(entries);
    await expect(listStoreInventoryMovements("store-1", new Date("2026-11-09T00:00:00Z"), 50)).resolves.toEqual(entries);
    expect(mocks.inventoryMovementFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { inventory: { warehouse: { storeId: "store-1" } } },
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    }));
  });

  it("rejects movement history access outside the seller's store scope", async () => {
    mocks.storeFindUnique.mockResolvedValue({ id: "store-other", seller: { ownerId: "another-owner", status: "ACTIVE" } });
    await expect(listStoreInventoryMovements("store-other")).rejects.toThrow("inventory access");
    expect(mocks.inventoryMovementFindMany).not.toHaveBeenCalled();
  });

  it("releases inspected quarantine into sellable stock and records both ledger deltas", async () => {
    const result = await decideQuarantinedStock({
      warehouseId: "warehouse-1", variantId: "variant-1", quantity: 2,
      decision: "RELEASE", idempotencyKey: "quarantine-release-0001"
    });
    expect(result.alreadyApplied).toBe(false);
    expect(mocks.inventoryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ quantityQuarantined: { gte: 2 } }),
      data: { quantityOnHand: { increment: 2 }, quantityQuarantined: { decrement: 2 } }
    }));
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "ADJUSTMENT", quantityDelta: 2, quarantinedDelta: -2, idempotencyKey: "quarantine-release-0001" })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("disposes quarantined stock without increasing sellable on-hand", async () => {
    await decideQuarantinedStock({
      warehouseId: "warehouse-1", variantId: "variant-1", quantity: 1,
      decision: "DISPOSE", idempotencyKey: "quarantine-dispose-0001"
    });
    expect(mocks.inventoryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { quantityQuarantined: { decrement: 1 } }
    }));
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantityDelta: 0, quarantinedDelta: -1 })
    }));
  });

  it("rejects quarantine decisions larger than the quarantined balance", async () => {
    mocks.inventoryFindUnique.mockResolvedValue({ id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 1 });
    await expect(decideQuarantinedStock({
      warehouseId: "warehouse-1", variantId: "variant-1", quantity: 2,
      decision: "RELEASE", idempotencyKey: "quarantine-release-0002"
    })).rejects.toThrow("Insufficient quarantined quantity");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
  });

  it("replays an identical quarantine decision without changing stock twice", async () => {
    mocks.inventoryMovementFindUnique.mockResolvedValue({
      id: "movement-existing", inventoryId: "inventory-1", quantityDelta: 2,
      quarantinedDelta: -2, type: "ADJUSTMENT", note: "released"
    });
    const result = await decideQuarantinedStock({
      warehouseId: "warehouse-1", variantId: "variant-1", quantity: 2,
      decision: "RELEASE", idempotencyKey: "quarantine-release-0003"
    });
    expect(result.alreadyApplied).toBe(true);
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.inventoryMovementCreate).not.toHaveBeenCalled();
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
