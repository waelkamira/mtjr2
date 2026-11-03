import "server-only";

import { AuditActorType, InventoryMovementType, Prisma, StockTransferStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

const warehouseSchema = z.object({
  storeId: z.string().trim().min(1),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/),
  name: z.string().trim().min(2).max(120)
}).strict();

const adjustmentSchema = z.object({
  warehouseId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantityDelta: z.number().int().min(-1000000).max(1000000).refine((value) => value !== 0),
  idempotencyKey: z.string().trim().min(16).max(160),
  note: z.string().trim().max(500).optional()
}).strict();

const transferSchema = z.object({
  sourceWarehouseId: z.string().trim().min(1),
  destinationWarehouseId: z.string().trim().min(1),
  reference: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().min(16).max(160),
  items: z.array(z.object({
    variantId: z.string().trim().min(1),
    quantity: z.number().int().min(1).max(1000000)
  }).strict()).min(1).max(100)
}).strict().refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
  message: "Source and destination warehouses must differ."
});

async function canManageInventory(userId: string, ownerId: string, storeId: string, now: Date) {
  if (userId === ownerId) return true;
  const [scoped, platform] = await Promise.all([
    userHasScopedPermission(userId, { permissionKey: "inventory:manage", scope: { type: "STORE", id: storeId }, now }),
    userHasPermission(userId, { permissionKey: "users:manage", now })
  ]);
  return scoped || platform;
}

async function requireWarehouseAccess(tx: Prisma.TransactionClient, warehouseId: string, userId: string, now: Date) {
  const warehouse = await tx.warehouse.findUnique({
    where: { id: warehouseId },
    select: {
      id: true, storeId: true, isActive: true,
      store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } }
    }
  });
  if (!warehouse || !warehouse.isActive || warehouse.store.status === "SUSPENDED" || warehouse.store.status === "CLOSED" || warehouse.store.seller.status !== "ACTIVE") {
    throw new Error("An active warehouse belonging to an active seller store is required.");
  }
  if (!(await canManageInventory(userId, warehouse.store.seller.ownerId, warehouse.storeId, now))) {
    throw new Error("You do not have inventory access to this store.");
  }
  return warehouse;
}

export async function createWarehouse(input: unknown, now = new Date()) {
  const data = warehouseSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, status: true, seller: { select: { status: true, ownerId: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") {
      throw new Error("An active seller store is required.");
    }
    if (!(await canManageInventory(actor.userId, store.seller.ownerId, store.id, now))) {
      throw new Error("You do not have inventory access to this store.");
    }
    const warehouse = await tx.warehouse.create({
      data: { storeId: store.id, code: data.code, name: data.name },
      select: { id: true, storeId: true, code: true, name: true, isActive: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.warehouse.created",
      resource: "warehouse", resourceId: warehouse.id, scopeType: "STORE", scopeId: store.id,
      occurredAt: now, metadata: { code: warehouse.code }
    }});
    return warehouse;
  });
}

export async function listStoreInventory(storeId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(storeId);
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || !(await canManageInventory(actor.userId, store.seller.ownerId, id, now))) {
    throw new Error("You do not have inventory access to this store.");
  }
  const rows = await prisma.inventory.findMany({
    where: { warehouse: { storeId: id, isActive: true } },
    orderBy: [{ warehouse: { name: "asc" } }, { variant: { sku: "asc" } }],
    take: 500,
    select: {
      id: true, quantityOnHand: true, quantityReserved: true, reorderPoint: true,
      warehouse: { select: { id: true, code: true, name: true } },
      variant: { select: { id: true, sku: true, name: true, product: { select: { id: true, name: true, slug: true } } } }
    }
  });
  return rows.map((row) => ({ ...row, quantityAvailable: row.quantityOnHand - row.quantityReserved, isLowStock: row.quantityOnHand - row.quantityReserved <= row.reorderPoint }));
}

export async function adjustInventory(input: unknown, now = new Date()) {
  const data = adjustmentSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const warehouse = await requireWarehouseAccess(tx, data.warehouseId, actor.userId, now);
    const variant = await tx.productVariant.findFirst({
      where: { id: data.variantId, product: { storeId: warehouse.storeId } },
      select: { id: true }
    });
    if (!variant) throw new Error("The product variant does not belong to this store.");
    let inventory = await tx.inventory.findUnique({
      where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } }
    });
    const existing = await tx.inventoryMovement.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      select: { id: true, inventoryId: true, quantityDelta: true, type: true }
    });
    if (existing) {
      if (!inventory || existing.inventoryId !== inventory.id || existing.quantityDelta !== data.quantityDelta || existing.type !== InventoryMovementType.ADJUSTMENT) {
        throw new Error("The idempotency key was already used for a different inventory operation.");
      }
      return { movementId: existing.id, inventoryId: existing.inventoryId, alreadyApplied: true };
    }
    if (!inventory) {
      if (data.quantityDelta < 0) throw new Error("Insufficient available stock.");
      inventory = await tx.inventory.create({
        data: { warehouseId: warehouse.id, variantId: variant.id, quantityOnHand: data.quantityDelta },
      });
    } else {
      if (data.quantityDelta < 0 && inventory.quantityOnHand - inventory.quantityReserved < Math.abs(data.quantityDelta)) {
        throw new Error("Adjustment would reduce available stock below zero.");
      }
      const changed = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved
        },
        data: { quantityOnHand: { increment: data.quantityDelta } }
      });
      if (changed.count !== 1) throw new Error("Inventory changed concurrently; retry the adjustment.");
    }
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id, type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: data.quantityDelta, idempotencyKey: data.idempotencyKey,
        note: data.note, createdById: actor.userId
      },
      select: { id: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.stock.adjusted",
      resource: "inventory", resourceId: inventory.id, scopeType: "STORE", scopeId: warehouse.storeId,
      occurredAt: now, metadata: { delta: data.quantityDelta, movementId: movement.id }
    }});
    return { movementId: movement.id, inventoryId: inventory.id, alreadyApplied: false };
  });
}

export async function createStockTransfer(input: unknown, now = new Date()) {
  const data = transferSchema.parse(input);
  const variantIds = data.items.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) throw new Error("A variant may appear only once in a stock transfer.");
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const source = await requireWarehouseAccess(tx, data.sourceWarehouseId, actor.userId, now);
    const destination = await requireWarehouseAccess(tx, data.destinationWarehouseId, actor.userId, now);
    if (source.storeId !== destination.storeId) throw new Error("Stock transfers must stay within one store.");
    const existing = await tx.stockTransfer.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { items: true }
    });
    if (existing) {
      const existingItems = existing.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })).sort((a, b) => a.variantId.localeCompare(b.variantId));
      const requestedItems = data.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })).sort((a, b) => a.variantId.localeCompare(b.variantId));
      if (existing.sourceWarehouseId !== source.id || existing.destinationWarehouseId !== destination.id || JSON.stringify(existingItems) !== JSON.stringify(requestedItems)) {
        throw new Error("The idempotency key was already used for a different stock transfer.");
      }
      return { id: existing.id, status: existing.status, sourceWarehouseId: existing.sourceWarehouseId, destinationWarehouseId: existing.destinationWarehouseId, alreadyApplied: true };
    }
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, product: { storeId: source.storeId } }, select: { id: true }
    });
    if (variants.length !== variantIds.length) throw new Error("Every transfer variant must belong to the same store.");
    const transfer = await tx.stockTransfer.create({
      data: {
        storeId: source.storeId, sourceWarehouseId: source.id,
        destinationWarehouseId: destination.id, reference: data.reference,
        idempotencyKey: data.idempotencyKey, createdById: actor.userId,
        items: { create: data.items }
      },
      select: { id: true, status: true, sourceWarehouseId: true, destinationWarehouseId: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.transfer.created",
      resource: "stock_transfer", resourceId: transfer.id, scopeType: "STORE", scopeId: source.storeId,
      occurredAt: now, metadata: { itemCount: data.items.length }
    }});
    return { ...transfer, alreadyApplied: false };
  });
}

export async function shipStockTransfer(transferId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(transferId);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!transfer || transfer.status !== StockTransferStatus.DRAFT) throw new Error("Only draft stock transfers can be shipped.");
    const source = await requireWarehouseAccess(tx, transfer.sourceWarehouseId, actor.userId, now);
    await requireWarehouseAccess(tx, transfer.destinationWarehouseId, actor.userId, now);
    for (const item of transfer.items) {
      const inventory = await tx.inventory.findUnique({
        where: { warehouseId_variantId: { warehouseId: source.id, variantId: item.variantId } }
      });
      if (!inventory || inventory.quantityOnHand - inventory.quantityReserved < item.quantity) {
        throw new Error("Insufficient available stock to ship this transfer.");
      }
      const changed = await tx.inventory.updateMany({
        where: { id: inventory.id, quantityOnHand: inventory.quantityOnHand, quantityReserved: inventory.quantityReserved },
        data: { quantityOnHand: { decrement: item.quantity } }
      });
      if (changed.count !== 1) throw new Error("Inventory changed concurrently; retry the transfer.");
      await tx.inventoryMovement.create({
        data: { inventoryId: inventory.id, type: InventoryMovementType.TRANSFER_OUT, quantityDelta: -item.quantity,
          referenceType: "STOCK_TRANSFER", referenceId: transfer.id, createdById: actor.userId }
      });
    }
    const changed = await tx.stockTransfer.updateMany({
      where: { id, status: StockTransferStatus.DRAFT }, data: { status: StockTransferStatus.SHIPPED, shippedAt: now }
    });
    if (changed.count !== 1) throw new Error("Transfer has already been processed.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.transfer.shipped",
      resource: "stock_transfer", resourceId: id, scopeType: "STORE", scopeId: source.storeId,
      occurredAt: now, metadata: { itemCount: transfer.items.length }
    }});
    return { transferId: id, status: StockTransferStatus.SHIPPED };
  });
}

export async function receiveStockTransfer(transferId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(transferId);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { items: true } });
    if (!transfer || transfer.status !== StockTransferStatus.SHIPPED) throw new Error("Only shipped stock transfers can be received.");
    const destination = await requireWarehouseAccess(tx, transfer.destinationWarehouseId, actor.userId, now);
    await requireWarehouseAccess(tx, transfer.sourceWarehouseId, actor.userId, now);
    for (const item of transfer.items) {
      const inventory = await tx.inventory.upsert({
        where: { warehouseId_variantId: { warehouseId: destination.id, variantId: item.variantId } },
        create: { warehouseId: destination.id, variantId: item.variantId, quantityOnHand: item.quantity },
        update: { quantityOnHand: { increment: item.quantity } }
      });
      await tx.inventoryMovement.create({
        data: { inventoryId: inventory.id, type: InventoryMovementType.TRANSFER_IN, quantityDelta: item.quantity,
          referenceType: "STOCK_TRANSFER", referenceId: transfer.id, createdById: actor.userId }
      });
    }
    const changed = await tx.stockTransfer.updateMany({
      where: { id, status: StockTransferStatus.SHIPPED }, data: { status: StockTransferStatus.RECEIVED, receivedAt: now }
    });
    if (changed.count !== 1) throw new Error("Transfer has already been received.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.transfer.received",
      resource: "stock_transfer", resourceId: id, scopeType: "STORE", scopeId: transfer.storeId,
      occurredAt: now, metadata: { itemCount: transfer.items.length }
    }});
    return { transferId: id, status: StockTransferStatus.RECEIVED };
  });
}


/** Lists recent stock transfers for a store after enforcing inventory scope. */
export async function listStoreStockTransfers(storeIdInput: string, now = new Date()) {
  const storeId = z.string().trim().min(1).parse(storeIdInput);
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || !(await canManageInventory(actor.userId, store.seller.ownerId, storeId, now))) {
    throw new Error("You do not have inventory access to this store.");
  }
  return prisma.stockTransfer.findMany({
    where: { storeId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true, reference: true, status: true, createdAt: true, shippedAt: true, receivedAt: true,
      sourceWarehouse: { select: { id: true, name: true, code: true } },
      destinationWarehouse: { select: { id: true, name: true, code: true } },
      items: { select: { quantity: true, variant: { select: { id: true, sku: true, name: true, product: { select: { name: true } } } } }
    }
  });
}
