import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  warehouseFindUnique: vi.fn(),
  warehouseUpdate: vi.fn(),
  inventoryFindFirst: vi.fn(),
  inventoryFindMany: vi.fn(),
  stockTransferFindFirst: vi.fn(),
  stockCountSessionCreate: vi.fn(),
  stockCountSessionFindUnique: vi.fn(),
  stockCountSessionFindFirst: vi.fn(),
  stockCountSessionUpdateMany: vi.fn(),
  stockCountLineUpdateMany: vi.fn(),
  stockCountLineFindUnique: vi.fn(),
  productVariantFindFirst: vi.fn(),
  productVariantFindMany: vi.fn(),
  inventoryFindUnique: vi.fn(),
  inventoryCreate: vi.fn(),
  inventoryUpsert: vi.fn(),
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
  inventory: { findUnique: mocks.inventoryFindUnique, findFirst: mocks.inventoryFindFirst, findMany: mocks.inventoryFindMany, create: mocks.inventoryCreate, upsert: mocks.inventoryUpsert, updateMany: mocks.inventoryUpdateMany },
  inventoryMovement: { findUnique: mocks.inventoryMovementFindUnique, create: mocks.inventoryMovementCreate, findMany: mocks.inventoryMovementFindMany },
  auditLog: { create: mocks.auditCreate },
  stockCountSession: { create: mocks.stockCountSessionCreate, findUnique: mocks.stockCountSessionFindUnique, findFirst: mocks.stockCountSessionFindFirst, updateMany: mocks.stockCountSessionUpdateMany },
  stockCountLine: { updateMany: mocks.stockCountLineUpdateMany, findUnique: mocks.stockCountLineFindUnique },
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

import { adjustInventory, createStockTransfer, shipStockTransfer, receiveStockTransfer, listStoreInventoryMovements, decideQuarantinedStock, updateWarehouse, createStockCount, recordStockCountLine, completeStockCount, cancelStockCount } from "@/server/inventory/stock";

describe("seller inventory operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.warehouseUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, storeId: "store-1", code: String(data.code ?? "MAIN"), name: String(data.name ?? "Main"), isActive: Boolean(data.isActive ?? true) }));
    mocks.inventoryFindFirst.mockResolvedValue(null);
    mocks.inventoryFindMany.mockResolvedValue([]);
    mocks.stockCountSessionFindFirst.mockResolvedValue(null);
    mocks.stockCountSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.stockCountLineUpdateMany.mockResolvedValue({ count: 1 });
    mocks.stockCountSessionCreate.mockResolvedValue({ id: "count-1" });
    mocks.stockTransferFindFirst.mockResolvedValue(null);
    mocks.stockTransferUpdateMany.mockResolvedValue({ count: 1 });
    mocks.warehouseFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id, storeId: "store-1", isActive: true,
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
    }));
    mocks.productVariantFindFirst.mockResolvedValue({ id: "variant-1" });
    mocks.inventoryMovementFindUnique.mockResolvedValue(null);
    mocks.inventoryFindUnique.mockResolvedValue({ id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 2 });
    mocks.inventoryMovementCreate.mockResolvedValue({ id: "movement-1" });
    mocks.inventoryCreate.mockResolvedValue({ id: "inventory-1", quantityOnHand: 10, quantityReserved: 0, quantityQuarantined: 0 });
    mocks.inventoryUpsert.mockResolvedValue({ id: "inventory-destination", quantityOnHand: 5 });
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

  it("blocks warehouse deactivation while a physical count is in progress", async () => {
    mocks.warehouseFindUnique.mockResolvedValue({
      id: "warehouse-1", storeId: "store-1", isActive: true,
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
    });
    mocks.stockCountSessionFindFirst.mockResolvedValue({ id: "count-1" });
    await expect(updateWarehouse("warehouse-1", { isActive: false })).rejects.toThrow("finish active stock counts");
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


  it("opens a physical count from a versioned inventory snapshot", async () => {
    const snapshotTime = new Date("2026-11-09T10:00:00Z");
    mocks.inventoryFindMany.mockResolvedValue([{ id: "inventory-1", quantityOnHand: 12, updatedAt: snapshotTime }]);
    mocks.stockCountSessionCreate.mockResolvedValue({ id: "count-1", lines: [{ id: "line-1", expectedQuantity: 12, expectedUpdatedAt: snapshotTime }] });
    await expect(createStockCount({ warehouseId: "warehouse-1" })).resolves.toMatchObject({ id: "count-1" });
    expect(mocks.stockCountSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ warehouseId: "warehouse-1", lines: { create: [{ inventoryId: "inventory-1", expectedQuantity: 12, expectedUpdatedAt: snapshotTime }] } })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "inventory.stock_count.opened" }) }));
  });

  it("saves a counted quantity only against a line in an open authorized session", async () => {
    mocks.stockCountSessionFindUnique.mockResolvedValue({ id: "count-1", status: "IN_PROGRESS", warehouseId: "warehouse-1", storeId: "store-1" });
    mocks.stockCountLineFindUnique.mockResolvedValue({ id: "line-1", countedQuantity: 9 });
    await expect(recordStockCountLine("count-1", "line-1", { countedQuantity: 9 })).resolves.toMatchObject({ id: "line-1" });
    expect(mocks.stockCountLineUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "line-1", sessionId: "count-1" }, data: expect.objectContaining({ countedQuantity: 9 }) }));
  });

  it("cancels an unfinished count without changing inventory", async () => {
    mocks.stockCountSessionFindUnique.mockResolvedValue({
      id: "count-cancel", storeId: "store-1", status: "IN_PROGRESS",
      warehouse: { store: { seller: { ownerId: "owner-1", status: "ACTIVE" } } }
    });
    await expect(cancelStockCount("count-cancel")).resolves.toMatchObject({ status: "CANCELLED", alreadyCancelled: false });
    expect(mocks.stockCountSessionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "count-cancel", status: "IN_PROGRESS" },
      data: { status: "CANCELLED" }
    }));
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it("reconciles count variances into stock movements and is replay-safe", async () => {
    const updatedAt = new Date("2026-11-09T10:00:00Z");
    mocks.stockCountSessionFindUnique.mockResolvedValue({
      id: "count-1", storeId: "store-1", status: "IN_PROGRESS", note: null,
      warehouse: { id: "warehouse-1", storeId: "store-1", isActive: true, store: { status: "ACTIVE", seller: { ownerId: "owner-1", status: "ACTIVE" } } },
      lines: [{ id: "line-1", inventoryId: "inventory-1", expectedQuantity: 10, expectedUpdatedAt: updatedAt, countedQuantity: 8, note: null,
        inventory: { id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 3, updatedAt } }]
    });
    mocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
    await expect(completeStockCount("count-1")).resolves.toMatchObject({ status: "COMPLETED", adjustedLines: 1, totalVariance: -2 });
    expect(mocks.inventoryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "inventory-1", quantityOnHand: 10, quantityReserved: { lte: 8 } }), data: { quantityOnHand: 8 } }));
    expect(mocks.inventoryUpdateMany.mock.calls[0][0].data).not.toHaveProperty("quantityQuarantined");
    expect(mocks.inventoryUpdateMany.mock.calls[0][0].data).not.toHaveProperty("quantityReserved");
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "ADJUSTMENT", quantityDelta: -2, referenceType: "STOCK_COUNT", idempotencyKey: "stock-count:count-1:line-1" }) }));
    expect(mocks.stockCountSessionUpdateMany).toHaveBeenCalledOnce();
  });

  it("rejects a physical count below already reserved stock", async () => {
    const updatedAt = new Date("2026-11-09T10:00:00Z");
    mocks.stockCountSessionFindUnique.mockResolvedValue({
      id: "count-reserved", storeId: "store-1", status: "IN_PROGRESS",
      warehouse: { id: "warehouse-1", storeId: "store-1", isActive: true, store: { status: "ACTIVE", seller: { ownerId: "owner-1", status: "ACTIVE" } } },
      lines: [{ id: "line-reserved", inventoryId: "inventory-1", expectedQuantity: 10, expectedUpdatedAt: updatedAt, countedQuantity: 1, note: null,
        inventory: { id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 4, updatedAt } }]
    });
    await expect(completeStockCount("count-reserved")).rejects.toThrow("lower than the quantity already reserved");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it("returns an authorized completed count replay without applying stock twice", async () => {
    mocks.stockCountSessionFindUnique.mockResolvedValue({
      id: "count-done", storeId: "store-1", status: "COMPLETED",
      warehouse: { id: "warehouse-1", storeId: "store-1", isActive: false, store: { status: "ACTIVE", seller: { ownerId: "owner-1", status: "ACTIVE" } } },
      lines: [{ id: "line-done", expectedQuantity: 5, countedQuantity: 7 }]
    });
    await expect(completeStockCount("count-done")).resolves.toMatchObject({ alreadyCompleted: true, totalVariance: 2 });
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.inventoryMovementCreate).not.toHaveBeenCalled();
  });

  it("rejects count reconciliation if inventory changed after the snapshot", async () => {
    const expectedUpdatedAt = new Date("2026-11-09T10:00:00Z");
    mocks.stockCountSessionFindUnique.mockResolvedValue({
      id: "count-2", storeId: "store-1", status: "IN_PROGRESS",
      warehouse: { id: "warehouse-1", storeId: "store-1", isActive: true, store: { status: "ACTIVE", seller: { ownerId: "owner-1", status: "ACTIVE" } } },
      lines: [{ id: "line-2", inventoryId: "inventory-1", expectedQuantity: 10, expectedUpdatedAt, countedQuantity: 9,
        inventory: { id: "inventory-1", quantityOnHand: 10, quantityReserved: 0, quantityQuarantined: 0, updatedAt: new Date("2026-11-09T10:05:00Z") } }]
    });
    await expect(completeStockCount("count-2")).rejects.toThrow("Inventory changed after this count was opened");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
  });

  it("does not reconcile an uncounted item or a physical quantity below reservations", async () => {
    const updatedAt = new Date("2026-11-09T10:00:00Z");
    const base = { id: "count-3", storeId: "store-1", status: "IN_PROGRESS",
      warehouse: { id: "warehouse-1", storeId: "store-1", isActive: true, store: { status: "ACTIVE", seller: { ownerId: "owner-1", status: "ACTIVE" } } } };
    mocks.stockCountSessionFindUnique.mockResolvedValue({ ...base, lines: [{ id: "line-3", inventoryId: "inventory-1", expectedQuantity: 10, expectedUpdatedAt: updatedAt, countedQuantity: null, inventory: { id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 0, updatedAt } }] });
    await expect(completeStockCount("count-3")).rejects.toThrow("Every stock item must be counted");
    mocks.stockCountSessionFindUnique.mockResolvedValue({ ...base, lines: [{ id: "line-3", inventoryId: "inventory-1", expectedQuantity: 10, expectedUpdatedAt: updatedAt, countedQuantity: 1, inventory: { id: "inventory-1", quantityOnHand: 10, quantityReserved: 2, quantityQuarantined: 0, updatedAt } }] });
    await expect(completeStockCount("count-3")).rejects.toThrow("lower than the quantity already reserved");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
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
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "ADJUSTMENT", quantityDelta: 5, referenceType: "MANUAL_ADJUSTMENT",
        referenceId: "adjustment-key-0002", idempotencyKey: "adjustment-key-0002"
      })
    }));
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

  it("receives a shipped transfer once and records the inbound movement", async () => {
    mocks.stockTransferFindUnique.mockResolvedValue({
      id: "transfer-receive", storeId: "store-1", status: "SHIPPED",
      sourceWarehouseId: "warehouse-1", destinationWarehouseId: "warehouse-2",
      items: [{ variantId: "variant-1", quantity: 5 }]
    });
    mocks.warehouseFindUnique
      .mockResolvedValueOnce({
        id: "warehouse-2", storeId: "store-1", isActive: true,
        store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
      })
      .mockResolvedValueOnce({
        id: "warehouse-1", storeId: "store-1", isActive: true,
        store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "owner-1" } }
      });

    await expect(receiveStockTransfer("transfer-receive")).resolves.toEqual({
      transferId: "transfer-receive", status: "RECEIVED"
    });

    expect(mocks.inventoryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { warehouseId_variantId: { warehouseId: "warehouse-2", variantId: "variant-1" } },
      create: { warehouseId: "warehouse-2", variantId: "variant-1", quantityOnHand: 5 },
      update: { quantityOnHand: { increment: 5 } }
    }));
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "TRANSFER_IN", quantityDelta: 5,
        referenceType: "STOCK_TRANSFER", referenceId: "transfer-receive"
      })
    }));
    expect(mocks.stockTransferUpdateMany).toHaveBeenCalledWith({
      where: { id: "transfer-receive", status: "SHIPPED" },
      data: { status: "RECEIVED", receivedAt: expect.any(Date) }
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
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
