import "server-only";

import { AuditActorType, ReturnItemStatus, ReturnRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

export async function listSellerReturnRequests(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const platformAdmin = await userHasPermission(actor.userId, { permissionKey: "users:manage", now });
  const stores = await prisma.store.findMany({
    where: platformAdmin ? { seller: { status: "ACTIVE" } } : {
      OR: [
        { seller: { ownerId: actor.userId, status: "ACTIVE" } },
        { staff: { some: { userId: actor.userId, status: "ACTIVE" } } }
      ]
    },
    select: { id: true, name: true, seller: { select: { ownerId: true, status: true } } }
  });

  const permittedStoreIds = (await Promise.all(stores.map(async (store) => {
    const isOwner = store.seller.ownerId === actor.userId;
    const delegated = await userHasScopedPermission(actor.userId, {
      permissionKey: "orders:manage",
      scope: { type: "STORE", id: store.id },
      now
    });
    return store.seller.status === "ACTIVE" && (platformAdmin || isOwner || delegated) ? store.id : null;
  }))).filter((id): id is string => Boolean(id));

  if (!permittedStoreIds.length) return { items: [] };

  const requests = await prisma.returnRequest.findMany({
    where: {
      items: {
        some: {
          orderItem: { vendorOrder: { storeId: { in: permittedStoreIds } } }
        }
      }
    },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    take: 200,
    include: {
      order: { select: { orderNumber: true } },
      items: {
        where: {
          orderItem: { vendorOrder: { storeId: { in: permittedStoreIds } } }
        },
        select: {
          id: true,
          status: true,
          reviewNote: true,
          quantity: true,
          orderItem: {
            select: {
              productName: true,
              sku: true,
              quantity: true,
              vendorOrder: {
                select: { storeId: true, store: { select: { name: true } } }
              }
            }
          }
        }
      }
    }
  });

  const items = requests.flatMap((request) => {
    const byStore = new Map<string, {
      storeName: string;
      products: Array<{ id: string; productName: string; sku: string; orderedQuantity: number; returnQuantity: number; status: string; reviewNote: string | null }>;
    }>();
    for (const item of request.items) {
      const vendor = item.orderItem.vendorOrder;
      const group = byStore.get(vendor.storeId) ?? { storeName: vendor.store.name, products: [] };
      group.products.push({
        id: item.id,
        status: item.status,
        reviewNote: item.reviewNote,
        productName: item.orderItem.productName,
        sku: item.orderItem.sku,
        orderedQuantity: item.orderItem.quantity,
        returnQuantity: item.quantity
      });
      byStore.set(vendor.storeId, group);
    }
    return [...byStore.entries()].map(([storeId, group]) => ({
      id: request.id,
      returnNumber: request.returnNumber,
      orderNumber: request.order.orderNumber,
      status: request.status,
      reasonCode: request.reasonCode,
      reasonDetails: request.reasonDetails,
      reviewNote: request.reviewNote,
      requestedAt: request.requestedAt.toISOString(),
      storeId,
      storeName: group.storeName,
      items: group.products
    }));
  });

  return { items };
}


const sellerDecisionSchema = z.object({
  storeId: z.string().trim().min(1).max(128),
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional()
}).strict();

/** A seller can decide only the return lines belonging to one authorized active store. */
export async function reviewSellerReturnItems(returnId: string, input: unknown, now = new Date()) {
  const data = sellerDecisionSchema.parse(input);
  const id = z.string().trim().min(1).max(128).parse(returnId);
  const actor = await requireCurrentSession(now);
  const platformAdmin = await userHasPermission(actor.userId, { permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, status: true, seller: { select: { ownerId: true, status: true } } }
    });
    if (!store || store.status !== "ACTIVE" || store.seller.status !== "ACTIVE") throw new Error("This store is not active.");
    const isOwner = store.seller.ownerId === actor.userId;
    const activeStaff = !isOwner && !platformAdmin ? await tx.sellerStaff.findFirst({
      where: { storeId: store.id, userId: actor.userId, status: "ACTIVE" },
      select: { id: true }
    }) : null;
    const delegated = Boolean(activeStaff) && await userHasScopedPermission(actor.userId, {
      permissionKey: "orders:manage", scope: { type: "STORE", id: store.id }, now
    });
    if (!isOwner && !delegated && !platformAdmin) throw new Error("Permission denied.");

    const current = await tx.returnRequest.findUnique({
      where: { id },
      select: { id: true, status: true, returnNumber: true, orderId: true }
    });
    if (!current || current.status === ReturnRequestStatus.CANCELLED || current.status === ReturnRequestStatus.REJECTED) {
      throw new Error("This return request is not open for seller review.");
    }

    const targetStatus = data.status as ReturnItemStatus;
    const changed = await tx.returnItem.updateMany({
      where: {
        returnRequestId: id,
        status: ReturnItemStatus.REQUESTED,
        orderItem: { vendorOrder: { storeId: store.id } }
      },
      data: { status: targetStatus, reviewNote: data.note || null, reviewedAt: now, reviewedById: actor.userId }
    });
    if (changed.count === 0) {
      const existing = await tx.returnItem.findMany({
        where: { returnRequestId: id, orderItem: { vendorOrder: { storeId: store.id } } },
        select: { status: true }
      });
      if (!existing.length) throw new Error("No items from this return belong to your store.");
      if (!existing.every((item) => item.status === targetStatus)) throw new Error("These return items have already been reviewed.");
      return { id, status: current.status, affectedItems: 0, changed: false };
    }

    const lines = await tx.returnItem.findMany({ where: { returnRequestId: id }, select: { status: true } });
    const allRejected = lines.length > 0 && lines.every((item) => item.status === ReturnItemStatus.REJECTED);
    const anyApproved = lines.some((item) => item.status === ReturnItemStatus.APPROVED || item.status === ReturnItemStatus.RECEIVED);
    const hasPending = lines.some((item) => item.status === ReturnItemStatus.REQUESTED);
    const aggregate = hasPending ? ReturnRequestStatus.REQUESTED
      : allRejected ? ReturnRequestStatus.REJECTED
      : anyApproved ? ReturnRequestStatus.APPROVED
      : current.status;
    if (aggregate !== current.status && [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED].includes(current.status)) {
      const parentChanged = await tx.returnRequest.updateMany({
        where: { id, status: current.status },
        data: { status: aggregate, reviewNote: data.note || null, reviewedAt: now, reviewedById: actor.userId }
      });
      if (parentChanged.count !== 1) throw new Error("The return request changed. Refresh and try again.");
    }

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.return_items.reviewed",
        resource: "return_request", resourceId: id, scopeType: "STORE", scopeId: store.id,
        occurredAt: now,
        metadata: { returnNumber: current.returnNumber, decision: targetStatus, affectedItems: changed.count, note: data.note || null }
      }
    });
    return { id, status: aggregate, affectedItems: changed.count, changed: changed.count > 0 };
  }, { isolationLevel: "Serializable" });
}
