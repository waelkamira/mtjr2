import "server-only";

import { AuditActorType, InventoryMovementType, Prisma, StockCountStatus, StockTransferStatus } from "@prisma/client";
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

export async function listStoreInventory(storeId: string, now = new Date(), searchInput: unknown = {}) {
  const id = z.string().trim().min(1).parse(storeId);
  const { q, cursor } = z.object({
    q: z.string().trim().max(120).optional(),
    cursor: z.string().trim().min(1).max(128).optional()
  }).strict().parse(searchInput);
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || !(await canManageInventory(actor.userId, store.seller.ownerId, id, now))) {
    throw new Error("You do not have inventory access to this store.");
  }
  const rows = await prisma.inventory.findMany({
    where: { warehouse: { storeId: id, isActive: true }, ...(q ? { OR: [
      { warehouse: { name: { contains: q, mode: "insensitive" as const } } }, { warehouse: { code: { contains: q, mode: "insensitive" as const } } },
      { variant: { sku: { contains: q, mode: "insensitive" as const } } }, { variant: { name: { contains: q, mode: "insensitive" as const } } },
      { variant: { product: { name: { contains: q, mode: "insensitive" as const } } } }, { variant: { product: { slug: { contains: q, mode: "insensitive" as const } } } }
    ] } : {}) },
    orderBy: [{ warehouse: { name: "asc" } }, { variant: { sku: "asc" } }, { id: "asc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 501,
    select: {
      id: true, quantityOnHand: true, quantityQuarantined: true, quantityReserved: true, reorderPoint: true,
      warehouse: { select: { id: true, code: true, name: true } },
      variant: { select: { id: true, sku: true, name: true, product: { select: { id: true, name: true, slug: true } } } }
    }
  });
  const hasMore = rows.length > 500;
  const page = hasMore ? rows.slice(0, 500) : rows;
  return {
    items: page.map((row) => ({ ...row, quantityAvailable: row.quantityOnHand - row.quantityReserved - row.quantityQuarantined, isLowStock: row.quantityOnHand - row.quantityReserved - row.quantityQuarantined <= row.reorderPoint })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null
  };
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
      if (data.quantityDelta < 0 && inventory.quantityOnHand - inventory.quantityReserved - inventory.quantityQuarantined < Math.abs(data.quantityDelta)) {
        throw new Error("Adjustment would reduce available stock below zero.");
      }
      const changed = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved,
          quantityQuarantined: inventory.quantityQuarantined
        },
        data: { quantityOnHand: { increment: data.quantityDelta } }
      });
      if (changed.count !== 1) throw new Error("Inventory changed concurrently; retry the adjustment.");
    }
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id, type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: data.quantityDelta, idempotencyKey: data.idempotencyKey,
        referenceType: "MANUAL_ADJUSTMENT", referenceId: data.idempotencyKey,
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
  }, { isolationLevel: "Serializable" });
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
      if (!inventory || inventory.quantityOnHand - inventory.quantityReserved - inventory.quantityQuarantined < item.quantity) {
        throw new Error("Insufficient available stock to ship this transfer.");
      }
      const changed = await tx.inventory.updateMany({
        where: { id: inventory.id, quantityOnHand: inventory.quantityOnHand, quantityReserved: inventory.quantityReserved, quantityQuarantined: inventory.quantityQuarantined },
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
  }, { isolationLevel: "Serializable" });
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
  }, { isolationLevel: "Serializable" });
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
      id: true,
      reference: true,
      status: true,
      createdAt: true,
      shippedAt: true,
      receivedAt: true,
      sourceWarehouse: { select: { id: true, name: true, code: true } },
      destinationWarehouse: { select: { id: true, name: true, code: true } },
      items: {
        select: {
          quantity: true,
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              product: { select: { name: true } }
            }
          }
        }
      }
    }
  });
}


/** Returns the latest stock ledger entries for a store without exposing other stores. */
export async function listStoreInventoryMovements(storeIdInput: string, now = new Date(), searchInput: unknown = {}) {
  const storeId = z.string().trim().min(1).parse(storeIdInput);
  const legacyLimitCall = typeof searchInput === "number";
  const { limit, cursor } = legacyLimitCall
    ? { limit: z.number().int().min(1).max(200).parse(searchInput), cursor: undefined }
    : z.object({
        limit: z.number().int().min(1).max(200).default(100),
        cursor: z.string().trim().min(1).max(128).optional()
      }).strict().parse(searchInput);
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || !(await canManageInventory(actor.userId, store.seller.ownerId, storeId, now))) {
    throw new Error("You do not have inventory access to this store.");
  }
  const rows = await prisma.inventoryMovement.findMany({
    where: { inventory: { warehouse: { storeId } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: legacyLimitCall ? limit : limit + 1,
    select: {
      id: true, type: true, quantityDelta: true, quarantinedDelta: true,
      referenceType: true, referenceId: true, note: true, createdAt: true,
      inventory: {
        select: {
          warehouse: { select: { id: true, name: true, code: true } },
          variant: { select: { id: true, sku: true, name: true, product: { select: { name: true } } } }
        }
      }
    }
  });
  if (legacyLimitCall) return rows;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null };
}


const quarantineDecisionSchema = z.object({
  warehouseId: z.string().trim().min(1),
  variantId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(1000000),
  decision: z.enum(["RELEASE", "DISPOSE"]),
  idempotencyKey: z.string().trim().min(16).max(160),
  note: z.string().trim().max(500).optional()
}).strict();

/** Releases inspected returns to sellable stock or removes them from quarantine as disposed. */
export async function decideQuarantinedStock(input: unknown, now = new Date()) {
  const data = quarantineDecisionSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const warehouse = await requireWarehouseAccess(tx, data.warehouseId, actor.userId, now);
    const variant = await tx.productVariant.findFirst({
      where: { id: data.variantId, product: { storeId: warehouse.storeId } },
      select: { id: true }
    });
    if (!variant) throw new Error("The product variant does not belong to this store.");

    const existing = await tx.inventoryMovement.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      select: { id: true, inventoryId: true, quantityDelta: true, quarantinedDelta: true, type: true, note: true }
    });
    const inventory = await tx.inventory.findUnique({
      where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } }
    });
    const expectedOnHandDelta = data.decision === "RELEASE" ? data.quantity : 0;
    if (existing) {
      if (!inventory || existing.inventoryId !== inventory.id || existing.type !== InventoryMovementType.ADJUSTMENT ||
        existing.quantityDelta !== expectedOnHandDelta || existing.quarantinedDelta !== -data.quantity) {
        throw new Error("The idempotency key was already used for a different quarantine decision.");
      }
      return { movementId: existing.id, inventoryId: existing.inventoryId, alreadyApplied: true };
    }
    if (!inventory || inventory.quantityQuarantined < data.quantity) {
      throw new Error("Insufficient quarantined quantity for this decision.");
    }

    const changed = await tx.inventory.updateMany({
      where: {
        id: inventory.id,
        quantityOnHand: inventory.quantityOnHand,
        quantityReserved: inventory.quantityReserved,
        quantityQuarantined: { gte: data.quantity }
      },
      data: {
        ...(data.decision === "RELEASE" ? { quantityOnHand: { increment: data.quantity } } : {}),
        quantityQuarantined: { decrement: data.quantity }
      }
    });
    if (changed.count !== 1) throw new Error("Quarantined stock changed concurrently; retry the decision.");

    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: InventoryMovementType.ADJUSTMENT,
        quantityDelta: expectedOnHandDelta,
        quarantinedDelta: -data.quantity,
        idempotencyKey: data.idempotencyKey,
        note: data.note || (data.decision === "RELEASE" ? "Inspected return released to sellable stock." : "Inspected return disposed from quarantine."),
        referenceType: "QUARANTINE_DECISION",
        referenceId: data.idempotencyKey,
        createdById: actor.userId
      },
      select: { id: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId,
      action: data.decision === "RELEASE" ? "inventory.quarantine.released" : "inventory.quarantine.disposed",
      resource: "inventory", resourceId: inventory.id, scopeType: "STORE", scopeId: warehouse.storeId,
      occurredAt: now, metadata: { quantity: data.quantity, movementId: movement.id, warehouseId: warehouse.id, variantId: variant.id }
    }});
    return { movementId: movement.id, inventoryId: inventory.id, alreadyApplied: false };
  }, { isolationLevel: "Serializable" });
}

const warehouseUpdateSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "At least one warehouse field must be supplied.");

/** Updates a store-owned warehouse. Deactivation is blocked while stock or transfers remain. */
export async function updateWarehouse(warehouseIdInput: string, input: unknown, now = new Date()) {
  const warehouseId = z.string().trim().min(1).parse(warehouseIdInput);
  const data = warehouseUpdateSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const current = await tx.warehouse.findUnique({
      where: { id: warehouseId },
      select: {
        id: true, storeId: true, isActive: true,
        store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } }
      }
    });
    if (!current || current.store.seller.status !== "ACTIVE" || current.store.status === "SUSPENDED" || current.store.status === "CLOSED") {
      throw new Error("An active seller store warehouse is required.");
    }
    if (!(await canManageInventory(actor.userId, current.store.seller.ownerId, current.storeId, now))) {
      throw new Error("You do not have inventory access to this store.");
    }
    if (data.isActive === false && current.isActive) {
      const [stock, pendingTransfers, activeCount] = await Promise.all([
        tx.inventory.findFirst({
          where: { warehouseId, OR: [
            { quantityOnHand: { gt: 0 } }, { quantityReserved: { gt: 0 } }, { quantityQuarantined: { gt: 0 } }
          ] },
          select: { id: true }
        }),
        tx.stockTransfer.findFirst({
          where: { OR: [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }], status: { in: [StockTransferStatus.DRAFT, StockTransferStatus.SHIPPED] } },
          select: { id: true }
        }),
        tx.stockCountSession.findFirst({ where: { warehouseId, status: StockCountStatus.IN_PROGRESS }, select: { id: true } })
      ]);
      if (stock || pendingTransfers || activeCount) {
        throw new Error("Move or reconcile all stock, complete pending transfers, and finish active stock counts before deactivating this warehouse.");
      }
    }
    const warehouse = await tx.warehouse.update({
      where: { id: warehouseId },
      data: { ...(data.code !== undefined ? { code: data.code } : {}), ...(data.name !== undefined ? { name: data.name } : {}), ...(data.isActive !== undefined ? { isActive: data.isActive } : {}) },
      select: { id: true, storeId: true, code: true, name: true, isActive: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId,
      action: data.isActive === false ? "inventory.warehouse.deactivated" : data.isActive === true ? "inventory.warehouse.reactivated" : "inventory.warehouse.updated",
      resource: "warehouse", resourceId: warehouse.id, scopeType: "STORE", scopeId: current.storeId,
      occurredAt: now, metadata: { changedFields: Object.keys(data) }
    }});
    return warehouse;
  }, { isolationLevel: "Serializable" });
}


const createStockCountSchema = z.object({
  warehouseId: z.string().trim().min(1),
  note: z.string().trim().max(500).optional()
}).strict();
const recordStockCountLineSchema = z.object({
  countedQuantity: z.number().int().min(0).max(100000000),
  note: z.string().trim().max(500).optional()
}).strict();

export async function createStockCount(input: unknown, now = new Date()) {
  const data = createStockCountSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const warehouse = await requireWarehouseAccess(tx, data.warehouseId, actor.userId, now);
    const inventories = await tx.inventory.findMany({
      where: { warehouseId: warehouse.id },
      orderBy: [{ variant: { sku: "asc" } }, { id: "asc" }],
      select: { id: true, quantityOnHand: true, updatedAt: true }
    });
    if (!inventories.length) throw new Error("There are no inventory records in this warehouse to count.");
    const session = await tx.stockCountSession.create({
      data: {
        storeId: warehouse.storeId, warehouseId: warehouse.id, note: data.note,
        createdById: actor.userId,
        lines: { create: inventories.map((inventory) => ({
          inventoryId: inventory.id, expectedQuantity: inventory.quantityOnHand, expectedUpdatedAt: inventory.updatedAt
        })) }
      },
      include: { lines: { include: { inventory: { select: {
        id: true, quantityOnHand: true, quantityReserved: true, quantityQuarantined: true, updatedAt: true,
        variant: { select: { id: true, sku: true, name: true, product: { select: { name: true } } }
        }
      } } } }, warehouse: { select: { id: true, code: true, name: true } } }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.stock_count.opened",
      resource: "stock_count_session", resourceId: session.id, scopeType: "STORE", scopeId: warehouse.storeId,
      occurredAt: now, metadata: { warehouseId: warehouse.id, lineCount: inventories.length }
    }});
    return session;
  }, { isolationLevel: "Serializable" });
}

export async function listStoreStockCounts(storeIdInput: string, now = new Date()) {
  const storeId = z.string().trim().min(1).parse(storeIdInput);
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || !(await canManageInventory(actor.userId, store.seller.ownerId, storeId, now))) {
    throw new Error("You do not have inventory access to this store.");
  }
  return prisma.stockCountSession.findMany({
    where: { storeId },
    orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true, status: true, note: true, openedAt: true, completedAt: true,
      warehouse: { select: { id: true, code: true, name: true } },
      _count: { select: { lines: true } },
      lines: { select: { countedQuantity: true } }
    }
  });
}

export async function recordStockCountLine(sessionIdInput: string, lineIdInput: string, input: unknown, now = new Date()) {
  const sessionId = z.string().trim().min(1).parse(sessionIdInput);
  const lineId = z.string().trim().min(1).parse(lineIdInput);
  const data = recordStockCountLineSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const session = await tx.stockCountSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, warehouseId: true, storeId: true }
    });
    if (!session) throw new Error("Stock count session not found.");
    if (session.status !== StockCountStatus.IN_PROGRESS) throw new Error("This stock count is no longer editable.");
    const warehouse = await requireWarehouseAccess(tx, session.warehouseId, actor.userId, now);
    if (warehouse.storeId !== session.storeId) throw new Error("Stock count warehouse scope is invalid.");
    const changed = await tx.stockCountLine.updateMany({
      where: { id: lineId, sessionId },
      data: { countedQuantity: data.countedQuantity, note: data.note, countedAt: now }
    });
    if (changed.count !== 1) throw new Error("Stock count line not found in this session.");
    return tx.stockCountLine.findUnique({
      where: { id: lineId },
      include: { inventory: { select: { id: true, quantityOnHand: true, quantityReserved: true, quantityQuarantined: true, variant: { select: { sku: true, name: true, product: { select: { name: true } } } } } } }
    });
  }, { isolationLevel: "Serializable" });
}

export async function completeStockCount(sessionIdInput: string, now = new Date()) {
  const sessionId = z.string().trim().min(1).parse(sessionIdInput);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const session = await tx.stockCountSession.findUnique({
      where: { id: sessionId },
      include: {
        warehouse: { select: { id: true, storeId: true, isActive: true, store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } } } },
        lines: { orderBy: [{ id: "asc" }], include: { inventory: { select: {
          id: true, quantityOnHand: true, quantityReserved: true, quantityQuarantined: true, updatedAt: true
        } } } }
      }
    });
    if (!session) throw new Error("Stock count session not found.");
    if (session.warehouse.store.seller.status !== "ACTIVE" ||
        session.warehouse.store.status === "SUSPENDED" || session.warehouse.store.status === "CLOSED" ||
        !(await canManageInventory(actor.userId, session.warehouse.store.seller.ownerId, session.storeId, now))) {
      throw new Error("You do not have access to this stock count.");
    }
    if (session.status === StockCountStatus.COMPLETED) {
      return { sessionId: session.id, status: session.status, alreadyCompleted: true, adjustedLines: 0, totalVariance: session.lines.reduce((sum, line) => sum + ((line.countedQuantity ?? line.expectedQuantity) - line.expectedQuantity), 0) };
    }
    if (session.status !== StockCountStatus.IN_PROGRESS) throw new Error("This stock count cannot be completed.");
    const warehouse = await requireWarehouseAccess(tx, session.warehouseId, actor.userId, now);
    if (warehouse.storeId !== session.storeId) throw new Error("Stock count warehouse scope is invalid.");
    const uncounted = session.lines.filter((line) => line.countedQuantity === null);
    if (uncounted.length) throw new Error("Every stock item must be counted before reconciliation.");
    let adjustedLines = 0;
    let totalVariance = 0;
    for (const line of session.lines) {
      const countedQuantity = line.countedQuantity as number;
      const delta = countedQuantity - line.expectedQuantity;
      if (line.inventory.quantityOnHand !== line.expectedQuantity || line.inventory.updatedAt.getTime() !== line.expectedUpdatedAt.getTime()) {
        throw new Error("Inventory changed after this count was opened. Cancel this count and start a fresh one.");
      }
      if (countedQuantity < line.inventory.quantityReserved) {
        throw new Error("A counted quantity cannot be lower than the quantity already reserved for orders.");
      }
      if (delta !== 0) {
        const changed = await tx.inventory.updateMany({
          where: {
            id: line.inventoryId, quantityOnHand: line.expectedQuantity,
            quantityReserved: { lte: countedQuantity }
          },
          data: { quantityOnHand: countedQuantity }
        });
        if (changed.count !== 1) throw new Error("Inventory changed during reconciliation; no partial count may be accepted.");
        await tx.inventoryMovement.create({ data: {
          inventoryId: line.inventoryId, type: InventoryMovementType.ADJUSTMENT,
          quantityDelta: delta, referenceType: "STOCK_COUNT", referenceId: session.id,
          idempotencyKey: `stock-count:${session.id}:${line.id}`,
          note: line.note ?? session.note ?? "Physical stock count reconciliation",
          createdById: actor.userId, createdAt: now
        }});
        adjustedLines += 1;
        totalVariance += delta;
      }
    }
    const completed = await tx.stockCountSession.updateMany({
      where: { id: session.id, status: StockCountStatus.IN_PROGRESS },
      data: { status: StockCountStatus.COMPLETED, completedAt: now }
    });
    if (completed.count !== 1) throw new Error("Stock count was completed by another request.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.stock_count.completed",
      resource: "stock_count_session", resourceId: session.id, scopeType: "STORE", scopeId: session.storeId,
      occurredAt: now, metadata: { warehouseId: session.warehouseId, lineCount: session.lines.length, adjustedLines, totalVariance }
    }});
    return { sessionId: session.id, status: StockCountStatus.COMPLETED, alreadyCompleted: false, adjustedLines, totalVariance };
  }, { isolationLevel: "Serializable" });
}


export async function getStockCount(sessionIdInput: string, now = new Date()) {
  const sessionId = z.string().trim().min(1).parse(sessionIdInput);
  const actor = await requireCurrentSession(now);
  const session = await prisma.stockCountSession.findUnique({
    where: { id: sessionId },
    include: {
      warehouse: { select: { id: true, code: true, name: true, store: { select: { seller: { select: { ownerId: true, status: true } } } } } },
      lines: { orderBy: [{ inventory: { variant: { sku: "asc" } } }, { id: "asc" }], include: {
        inventory: { select: { id: true, quantityOnHand: true, quantityReserved: true, quantityQuarantined: true, variant: { select: { sku: true, name: true, product: { select: { name: true } } } } }
      } } }
    }
  });
  if (!session || session.warehouse.store.seller.status !== "ACTIVE" ||
      !(await canManageInventory(actor.userId, session.warehouse.store.seller.ownerId, session.storeId, now))) {
    throw new Error("You do not have access to this stock count.");
  }
  return session;
}


export async function cancelStockCount(sessionIdInput: string, now = new Date()) {
  const sessionId = z.string().trim().min(1).parse(sessionIdInput);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const session = await tx.stockCountSession.findUnique({
      where: { id: sessionId },
      select: { id: true, storeId: true, status: true, warehouse: { select: { store: { select: { seller: { select: { ownerId: true, status: true } } } } } } }
    });
    if (!session || session.warehouse.store.seller.status !== "ACTIVE" ||
        !(await canManageInventory(actor.userId, session.warehouse.store.seller.ownerId, session.storeId, now))) {
      throw new Error("You do not have access to this stock count.");
    }
    if (session.status === StockCountStatus.CANCELLED) return { sessionId, status: StockCountStatus.CANCELLED, alreadyCancelled: true };
    if (session.status !== StockCountStatus.IN_PROGRESS) throw new Error("A completed stock count cannot be cancelled.");
    const changed = await tx.stockCountSession.updateMany({
      where: { id: sessionId, status: StockCountStatus.IN_PROGRESS },
      data: { status: StockCountStatus.CANCELLED }
    });
    if (changed.count !== 1) throw new Error("Stock count changed concurrently; refresh and try again.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "inventory.stock_count.cancelled",
      resource: "stock_count_session", resourceId: sessionId, scopeType: "STORE", scopeId: session.storeId,
      occurredAt: now, metadata: { cancelledWithoutStockAdjustment: true }
    }});
    return { sessionId, status: StockCountStatus.CANCELLED, alreadyCancelled: false };
  }, { isolationLevel: "Serializable" });
}
