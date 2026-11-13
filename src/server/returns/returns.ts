import "server-only";

import { randomBytes } from "node:crypto";
import { AuditActorType, Prisma, ReturnItemStatus, ReturnRequestStatus, VendorOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

function displayRefundAmount(amountMinor: bigint, currencyCode: string, minorUnit: number) {
  const scale = BigInt(10) ** BigInt(minorUnit);
  const whole = amountMinor / scale;
  const fraction = minorUnit ? (amountMinor % scale).toString().padStart(minorUnit, "0") : "";
  return `${currencyCode} ${new Intl.NumberFormat("en").format(whole)}${minorUnit ? "." + fraction : ""}`;
}

const reasons = ["DAMAGED", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"] as const;
const createSchema = z.object({
  orderId: z.string().trim().min(1).max(128),
  reasonCode: z.enum(reasons),
  reasonDetails: z.string().trim().max(2000).optional(),
  items: z.array(z.object({
    orderItemId: z.string().trim().min(1).max(128),
    quantity: z.number().int().min(1).max(10000)
  }).strict()).min(1).max(50)
}).strict().superRefine((value, ctx) => {
  const ids = value.items.map((item) => item.orderItemId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Each order item may appear only once.", path: ["items"] });
});
const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional()
}).strict();

function returnNumber(now: Date) {
  return `RET-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function getMyReturnCenter(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const [requests, orders] = await Promise.all([
    prisma.returnRequest.findMany({
      where: { customerId: actor.userId },
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: 100,
      include: {
        order: { select: { orderNumber: true } },
        items: { include: { orderItem: { select: { productName: true, sku: true, quantity: true, vendorOrder: { select: { store: { select: { name: true } } } } } } } },
        refund: { select: { status: true, amountMinor: true, currencyCode: true, currency: { select: { minorUnit: true } } } }
      }
    }),
    prisma.order.findMany({
      where: { userId: actor.userId, vendorOrders: { some: { status: VendorOrderStatus.DELIVERED } } },
      orderBy: { placedAt: "desc" },
      take: 50,
      select: {
        id: true, orderNumber: true, placedAt: true,
        vendorOrders: {
          where: { status: VendorOrderStatus.DELIVERED },
          select: { id: true, store: { select: { name: true } }, items: { select: { id: true, productName: true, sku: true, quantity: true } } }
        }
      }
    })
  ]);
  const itemIds = orders.flatMap((order) => order.vendorOrders.flatMap((vendor) => vendor.items.map((item) => item.id)));
  const previouslyRequested = itemIds.length ? await prisma.returnItem.groupBy({
    by: ["orderItemId"],
    where: { orderItemId: { in: itemIds }, status: { notIn: ["REJECTED", "CANCELLED"] }, returnRequest: { status: { notIn: [ReturnRequestStatus.REJECTED, ReturnRequestStatus.CANCELLED] } } },
    _sum: { quantity: true }
  }) : [];
  const returnedByItem = new Map(previouslyRequested.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
  const eligibleOrders = orders.map((order) => ({
    id: order.id, orderNumber: order.orderNumber, placedAt: order.placedAt.toISOString(),
    vendorOrders: order.vendorOrders.map((vendor) => ({
      id: vendor.id, storeName: vendor.store.name,
      items: vendor.items.map((item) => ({
        id: item.id, productName: item.productName, sku: item.sku, orderedQuantity: item.quantity,
        availableQuantity: Math.max(0, item.quantity - (returnedByItem.get(item.id) ?? 0))
      })).filter((item) => item.availableQuantity > 0)
    })).filter((vendor) => vendor.items.length > 0)
  })).filter((order) => order.vendorOrders.length > 0);
  return {
    requests: requests.map((request) => ({
      id: request.id, returnNumber: request.returnNumber, orderNumber: request.order.orderNumber,
      status: request.status, reasonCode: request.reasonCode, reasonDetails: request.reasonDetails,
      reviewNote: request.reviewNote, requestedAt: request.requestedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      refund: request.refund ? {
        status: request.refund.status,
        amountMinor: request.refund.amountMinor.toString(),
        amountDisplay: displayRefundAmount(request.refund.amountMinor, request.refund.currencyCode, request.refund.currency.minorUnit)
      } : null,
      items: request.items.map((item) => ({ id: item.id, productName: item.orderItem.productName, sku: item.orderItem.sku, quantity: item.quantity, status: item.status, reviewNote: item.reviewNote }))
    })),
    eligibleOrders
  };
}

export async function createMyReturnRequest(input: unknown, now = new Date()) {
  const data = createSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: data.orderId, userId: actor.userId },
      select: {
        id: true, orderNumber: true,
        vendorOrders: {
          where: { status: VendorOrderStatus.DELIVERED },
          select: { items: { where: { id: { in: data.items.map((item) => item.orderItemId) } }, select: { id: true, quantity: true, productName: true } } }
        }
      }
    });
    if (!order) throw new Error("Only your delivered order items can be returned.");
    const deliveredItems = order.vendorOrders.flatMap((vendor) => vendor.items);
    if (deliveredItems.length !== data.items.length) throw new Error("One or more items are not part of a delivered order.");
    const requested = await tx.returnItem.groupBy({
      by: ["orderItemId"],
      where: {
        orderItemId: { in: data.items.map((item) => item.orderItemId) },
        status: { notIn: ["REJECTED", "CANCELLED"] },
        returnRequest: { status: { notIn: [ReturnRequestStatus.REJECTED, ReturnRequestStatus.CANCELLED] } }
      },
      _sum: { quantity: true }
    });
    const previous = new Map(requested.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
    for (const requestedItem of data.items) {
      const ordered = deliveredItems.find((item) => item.id === requestedItem.orderItemId)!;
      if (requestedItem.quantity + (previous.get(requestedItem.orderItemId) ?? 0) > ordered.quantity) {
        throw new Error(`Return quantity exceeds the remaining quantity for ${ordered.productName}.`);
      }
    }
    const request = await tx.returnRequest.create({
      data: {
        returnNumber: returnNumber(now), orderId: order.id, customerId: actor.userId,
        reasonCode: data.reasonCode, reasonDetails: data.reasonDetails || null,
        items: { create: data.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })) }
      },
      select: { id: true, returnNumber: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "returns.requested",
        resource: "return_request", resourceId: request.id, scopeType: "ORDER", scopeId: order.id,
        occurredAt: now, metadata: { returnNumber: request.returnNumber, reasonCode: data.reasonCode, itemCount: data.items.length }
      }
    });
    return request;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getMyReturnRequest(returnId: string, now = new Date()) {
  const actor = await requireCurrentSession(now);
  const request = await prisma.returnRequest.findFirst({
    where: { id: returnId, customerId: actor.userId },
    include: { order: { select: { orderNumber: true } }, items: { include: { orderItem: { select: { productName: true, sku: true, quantity: true } } } } }
  });
  if (!request) throw new Error("Return request not found.");
  return {
    id: request.id, returnNumber: request.returnNumber, orderNumber: request.order.orderNumber,
    status: request.status, reasonCode: request.reasonCode, reasonDetails: request.reasonDetails,
    reviewNote: request.reviewNote, requestedAt: request.requestedAt.toISOString(), reviewedAt: request.reviewedAt?.toISOString() ?? null,
    items: request.items.map((item) => ({ productName: item.orderItem.productName, sku: item.orderItem.sku, orderedQuantity: item.orderItem.quantity, quantity: item.quantity }))
  };
}

export async function listReturnRequestsForAdmin(now = new Date()) {
  await requirePermission({ permissionKey: "returns:manage", now });
  const rows = await prisma.returnRequest.findMany({
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }], take: 200,
    include: {
      order: { select: { orderNumber: true } },
      customer: { select: { id: true, displayName: true, email: true } },
      items: { include: { orderItem: { select: { productName: true, sku: true, quantity: true, vendorOrder: { select: { store: { select: { name: true } } } } } } } }
    }
  });
  return rows.map((row) => ({
    id: row.id, returnNumber: row.returnNumber, orderNumber: row.order.orderNumber,
    customer: row.customer.displayName || row.customer.email, customerEmail: row.customer.email,
    status: row.status, reasonCode: row.reasonCode, reasonDetails: row.reasonDetails, reviewNote: row.reviewNote,
    requestedAt: row.requestedAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null,
    items: row.items.map((item) => ({ productName: item.orderItem.productName, sku: item.orderItem.sku, storeName: item.orderItem.vendorOrder.store.name, orderedQuantity: item.orderItem.quantity, quantity: item.quantity }))
  }));
}

export async function reviewReturnRequest(returnId: string, input: unknown, now = new Date()) {
  const data = reviewSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "returns:manage", now });
  return prisma.$transaction(async (tx) => {
    const current = await tx.returnRequest.findUnique({ where: { id: returnId }, select: { id: true, status: true } });
    if (!current) throw new Error("Return request not found.");
    const allowed = current.status === ReturnRequestStatus.REQUESTED;
    if (!allowed) throw new Error("Only pending return requests can be approved or rejected. Sellers record physical receipt through their store inventory.");
    const changed = await tx.returnRequest.updateMany({
      where: { id: current.id, status: current.status },
      data: { status: data.status, reviewNote: data.note || null, reviewedAt: now, reviewedById: actor.userId }
    });
    if (changed.count !== 1) throw new Error("The return request changed. Refresh and try again.");
    const updatedItems = await tx.returnItem.updateMany({
      where: { returnRequestId: current.id, status: ReturnItemStatus.REQUESTED },
      data: { status: data.status as ReturnItemStatus, reviewNote: data.note || null, reviewedAt: now, reviewedById: actor.userId }
    });
    if (updatedItems.count === 0) throw new Error("There are no pending return items to review.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "returns.platform_wide_review_decision",
        resource: "return_request", resourceId: current.id, scopeType: "RETURN_REQUEST", scopeId: current.id,
        occurredAt: now, metadata: {
          decisionScope: "PLATFORM_WIDE_RETURN_REQUEST",
          from: current.status,
          to: data.status,
          affectedItemCount: updatedItems.count,
          note: data.note || null
        }
      }
    });
    return { id: current.id, status: data.status };
  });
}
