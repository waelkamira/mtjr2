import "server-only";

import { AuditActorType, InventoryMovementType, ReturnItemStatus, ReturnRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

const receiptSchema = z.object({
  storeId: z.string().trim().min(1).max(128),
  warehouseId: z.string().trim().min(1).max(128),
  note: z.string().trim().max(1000).optional()
}).strict();

/**
 * Records physical receipt into quarantine for one store only. Quarantined
 * quantities are excluded from quantityOnHand and therefore from sellable stock.
 */
export async function receiveSellerReturnItems(returnIdInput: string, input: unknown, now = new Date()) {
  const data = receiptSchema.parse(input);
  const returnId = z.string().trim().min(1).max(128).parse(returnIdInput);
  const actor = await requireCurrentSession(now);
  const platformAdmin = await userHasPermission(actor.userId, { permissionKey: "users:manage", now });

  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({
      where: { id: data.warehouseId },
      select: {
        id: true, storeId: true, isActive: true,
        store: { select: { id: true, status: true, seller: { select: { ownerId: true, status: true } } } }
      }
    });
    if (!warehouse || warehouse.storeId !== data.storeId || !warehouse.isActive ||
      warehouse.store.status !== "ACTIVE" || warehouse.store.seller.status !== "ACTIVE") {
      throw new Error("Select an active warehouse belonging to this active store.");
    }

    const isOwner = warehouse.store.seller.ownerId === actor.userId;
    const activeStaff = !isOwner && !platformAdmin ? await tx.sellerStaff.findFirst({
      where: { storeId: warehouse.storeId, userId: actor.userId, status: "ACTIVE" },
      select: { id: true }
    }) : null;
    const delegated = Boolean(activeStaff) && await userHasScopedPermission(actor.userId, {
      permissionKey: "returns:manage", scope: { type: "STORE", id: warehouse.storeId }, now
    });
    if (!isOwner && !delegated && !platformAdmin) throw new Error("Permission denied.");

    const request = await tx.returnRequest.findUnique({
      where: { id: returnId },
      select: { id: true, returnNumber: true, status: true }
    });
    if (!request || request.status === ReturnRequestStatus.CANCELLED || request.status === ReturnRequestStatus.REJECTED) {
      throw new Error("This return request is not open for receipt.");
    }

    const approved = await tx.returnItem.findMany({
      where: {
        returnRequestId: returnId,
        status: ReturnItemStatus.APPROVED,
        orderItem: { vendorOrder: { storeId: warehouse.storeId } }
      },
      select: {
        id: true, quantity: true,
        orderItem: { select: { variantId: true, sku: true } }
      }
    });

    if (!approved.length) {
      const storeLines = await tx.returnItem.findMany({
        where: { returnRequestId: returnId, orderItem: { vendorOrder: { storeId: warehouse.storeId } } },
        select: { status: true }
      });
      if (storeLines.length && storeLines.every((line) =>
        line.status === ReturnItemStatus.RECEIVED || line.status === ReturnItemStatus.REJECTED
      ) && storeLines.some((line) => line.status === ReturnItemStatus.RECEIVED)) {
        return { returnId, storeId: warehouse.storeId, receivedItems: 0, alreadyApplied: true };
      }
      throw new Error("There are no approved return items awaiting receipt for this store.");
    }

    if (approved.some((item) => !item.orderItem.variantId)) {
      throw new Error("A returned item has no active product variant and cannot be recorded in inventory.");
    }

    const movementIds: string[] = [];
    let quarantinedQuantity = 0;
    for (const item of approved) {
      const variantId = item.orderItem.variantId!;
      const inventory = await tx.inventory.upsert({
        where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId } },
        create: { warehouseId: warehouse.id, variantId, quantityOnHand: 0, quantityQuarantined: item.quantity },
        update: { quantityQuarantined: { increment: item.quantity } },
        select: { id: true }
      });
      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: InventoryMovementType.RETURN_RECEIPT,
          quantityDelta: 0,
          quarantinedDelta: item.quantity,
          referenceType: "RETURN_ITEM",
          referenceId: item.id,
          idempotencyKey: `return-receipt:${item.id}`,
          note: data.note || `Physical return received for ${request.returnNumber}; awaiting inspection.`,
          createdById: actor.userId
        },
        select: { id: true }
      });
      movementIds.push(movement.id);
      quarantinedQuantity += item.quantity;
    }

    const received = await tx.returnItem.updateMany({
      where: {
        returnRequestId: returnId,
        status: ReturnItemStatus.APPROVED,
        orderItem: { vendorOrder: { storeId: warehouse.storeId } }
      },
      data: {
        status: ReturnItemStatus.RECEIVED,
        reviewNote: data.note || null,
        reviewedAt: now,
        reviewedById: actor.userId
      }
    });
    if (received.count !== approved.length) {
      throw new Error("Return items changed during receipt; no inventory changes were committed.");
    }

    const allLines = await tx.returnItem.findMany({
      where: { returnRequestId: returnId },
      select: { status: true }
    });
    const hasPending = allLines.some((line) => line.status === ReturnItemStatus.REQUESTED);
    const hasApproved = allLines.some((line) => line.status === ReturnItemStatus.APPROVED);
    const allRejected = allLines.length > 0 && allLines.every((line) => line.status === ReturnItemStatus.REJECTED);
    const aggregate = hasPending ? ReturnRequestStatus.REQUESTED
      : hasApproved ? ReturnRequestStatus.APPROVED
      : allRejected ? ReturnRequestStatus.REJECTED
      : ReturnRequestStatus.RECEIVED;

    if (aggregate !== request.status) {
      const changed = await tx.returnRequest.updateMany({
        where: { id: returnId, status: request.status },
        data: { status: aggregate, reviewNote: data.note || null, reviewedAt: now, reviewedById: actor.userId }
      });
      if (changed.count !== 1) throw new Error("The return request changed during receipt; retry.");
    }

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "seller.return_items.received",
        resource: "return_request", resourceId: returnId,
        scopeType: "STORE", scopeId: warehouse.storeId,
        occurredAt: now,
        metadata: { returnNumber: request.returnNumber, warehouseId: warehouse.id, itemCount: received.count, quarantinedQuantity, movementIds }
      }
    });

    return {
      returnId, storeId: warehouse.storeId, warehouseId: warehouse.id,
      receivedItems: received.count, quarantinedQuantity, movementIds, alreadyApplied: false
    };
  }, { isolationLevel: "Serializable" });
}
