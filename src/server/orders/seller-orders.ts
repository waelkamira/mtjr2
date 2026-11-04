import "server-only";

import { AuditActorType, OrderStatus, Prisma, VendorOrderStatus } from "@prisma/client";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

export async function listSellerVendorOrders(now = new Date(), searchInput: unknown = {}) {
  const { q } = z.object({ q: z.string().trim().max(120).optional() }).strict().parse(searchInput);
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
  const allowed = await Promise.all(stores.map(async (store) => {
    const isOwner = store.seller.ownerId === actor.userId;
    const delegated = await userHasScopedPermission(actor.userId, {
      permissionKey: "orders:manage", scope: { type: "STORE", id: store.id }, now
    });
    return store.seller.status === "ACTIVE" && (platformAdmin || isOwner || delegated) ? store.id : null;
  }));
  const storeIds = allowed.filter((id): id is string => Boolean(id));
  if (!storeIds.length) return { orders: [] };

  const vendorOrders = await prisma.vendorOrder.findMany({
    where: { storeId: { in: storeIds }, ...(q ? { OR: [
      { order: { orderNumber: { contains: q, mode: "insensitive" as const } } },
      { store: { name: { contains: q, mode: "insensitive" as const } } },
      { items: { some: { OR: [{ productName: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }, { variantName: { contains: q, mode: "insensitive" as const } }] } } }
    ] } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      store: { select: { id: true, name: true, slug: true } },
      order: { select: { id: true, orderNumber: true, status: true, currencyCode: true, placedAt: true, currency: { select: { minorUnit: true } } } },
      shipment: { select: { carrierName: true, trackingNumber: true, trackingUrl: true, shippedAt: true } },
      items: { orderBy: { createdAt: "asc" }, select: { id: true, productName: true, sku: true, variantName: true, quantity: true, unitAmountMinor: true, lineTotalMinor: true } }
    }
  });
  return {
    orders: vendorOrders.map((vendor) => ({
      id: vendor.id, status: vendor.status, store: vendor.store,
      shippingServiceName: vendor.shippingServiceName, shippingDestinationRegion: vendor.shippingDestinationRegion,
      minDeliveryDays: vendor.minDeliveryDays, maxDeliveryDays: vendor.maxDeliveryDays,
      order: vendor.order,
      subtotalMinor: vendor.subtotalMinor.toString(), shippingMinor: vendor.shippingMinor.toString(),
      taxMinor: vendor.taxMinor.toString(), totalMinor: vendor.totalMinor.toString(),
      shipment: vendor.shipment ? { ...vendor.shipment, shippedAt: vendor.shipment.shippedAt.toISOString() } : null,
      items: vendor.items.map((item) => ({
        ...item, unitAmountMinor: item.unitAmountMinor.toString(), lineTotalMinor: item.lineTotalMinor.toString()
      }))
    }))
  };
}


const sellerOrderTransitionSchema = z.object({
  status: z.enum(["PROCESSING", "READY_TO_SHIP"]),
  note: z.string().trim().max(500).optional()
}).strict();

/**
 * Seller-side preparation only. Shipment labels, carrier handoff, delivery
 * confirmation and cancellation are intentionally separate workflows.
 * A seller cannot process an order until a verified payment webhook has moved
 * its vendor order out of PENDING_PAYMENT.
 */
export async function transitionSellerVendorOrder(vendorOrderId: string, input: unknown, now = new Date()) {
  const data = sellerOrderTransitionSchema.parse(input);
  const actor = await requireCurrentSession(now);
  const id = z.string().trim().min(1).max(128).parse(vendorOrderId);

  const expected = data.status === "PROCESSING" ? VendorOrderStatus.CONFIRMED : VendorOrderStatus.PROCESSING;
  const note = data.note || (data.status === "PROCESSING" ? "Seller started order processing." : "Seller marked order ready to ship.");

  return prisma.$transaction(async (tx) => {
    const current = await tx.vendorOrder.findUnique({
      where: { id },
      select: {
        id: true, orderId: true, storeId: true, status: true,
        shipment: { select: { id: true, carrierName: true, trackingNumber: true, trackingUrl: true, shippedAt: true } },
        order: { select: { status: true, orderNumber: true } },
        store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } }
      }
    });
    if (!current) throw new Error("Seller order not found.");
    if (current.store.status !== "ACTIVE" || current.store.seller.status !== "ACTIVE") {
      throw new Error("This store is not active.");
    }

    const isOwner = current.store.seller.ownerId === actor.userId;
    if (!isOwner) {
      const [activeStaff, assignments] = await Promise.all([
        tx.sellerStaff.findFirst({
          where: { storeId: current.storeId, userId: actor.userId, status: "ACTIVE" },
          select: { id: true }
        }),
        tx.userRoleAssignment.findMany({
          where: { userId: actor.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: {
            scopeType: true, scopeId: true,
            role: { select: { permissions: { select: { permission: { select: { key: true } } } } } }
          }
        })
      ]);
      const hasGlobalGrant = assignments.some((assignment) =>
        assignment.scopeType === "GLOBAL" && assignment.scopeId === "GLOBAL"
        && assignment.role.permissions.some(({ permission }) => permission.key === "orders:manage")
      );
      const hasStoreGrant = Boolean(activeStaff) && assignments.some((assignment) =>
        assignment.scopeType === "STORE" && assignment.scopeId === current.storeId
        && assignment.role.permissions.some(({ permission }) => permission.key === "orders:manage")
      );
      if (!hasGlobalGrant && !hasStoreGrant) throw new PermissionDeniedError();
    }

    if (current.status === data.status) return { id, status: current.status, changed: false };
    if (current.status !== expected) {
      throw new Error("This seller order cannot move to the selected status. Refresh and try again.");
    }
    if (current.order.status !== OrderStatus.CONFIRMED && current.order.status !== OrderStatus.PROCESSING) {
      throw new Error("The parent order is not confirmed for seller processing.");
    }

    const changed = await tx.vendorOrder.updateMany({
      where: { id, storeId: current.storeId, status: expected },
      data: { status: data.status }
    });
    if (changed.count !== 1) throw new Error("The seller order changed. Refresh and try again.");

    await tx.vendorOrderStatusHistory.create({
      data: { vendorOrderId: id, status: data.status, note, actorId: actor.userId, createdAt: now }
    });

    if (data.status === "PROCESSING" && current.order.status === OrderStatus.CONFIRMED) {
      const parentChanged = await tx.order.updateMany({
        where: { id: current.orderId, status: OrderStatus.CONFIRMED },
        data: { status: OrderStatus.PROCESSING }
      });
      if (parentChanged.count === 1) {
        await tx.orderStatusHistory.create({
          data: { orderId: current.orderId, status: OrderStatus.PROCESSING, note: "Seller processing started.", actorId: actor.userId, createdAt: now }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.vendor_order.status_changed",
        resource: "vendor_order", resourceId: id, scopeType: "STORE", scopeId: current.storeId,
        occurredAt: now,
        metadata: { from: expected, to: data.status, orderId: current.orderId, orderNumber: current.order.orderNumber }
      }
    });

    return { id, status: data.status, changed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}


const sellerShipmentSchema = z.object({
  carrierName: z.string().trim().min(2).max(120),
  trackingNumber: z.string().trim().min(3).max(160),
  trackingUrl: z.string().trim().url().max(2048).refine((value) => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Tracking URL must use HTTPS and cannot contain credentials.").optional()
}).strict();

/** Seller-entered dispatch details; this does not claim carrier API verification. */
export async function createSellerShipment(vendorOrderId: string, input: unknown, now = new Date()) {
  const data = sellerShipmentSchema.parse(input);
  const actor = await requireCurrentSession(now);
  const id = z.string().trim().min(1).max(128).parse(vendorOrderId);

  return prisma.$transaction(async (tx) => {
    const current = await tx.vendorOrder.findUnique({
      where: { id },
      select: {
        id: true, orderId: true, storeId: true, status: true,
        order: { select: { status: true, orderNumber: true } },
        store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } }
      }
    });
    if (!current) throw new Error("Seller order not found.");
    if (current.store.status !== "ACTIVE" || current.store.seller.status !== "ACTIVE") throw new Error("This store is not active.");

    const isOwner = current.store.seller.ownerId === actor.userId;
    if (!isOwner) {
      const [activeStaff, assignments] = await Promise.all([
        tx.sellerStaff.findFirst({ where: { storeId: current.storeId, userId: actor.userId, status: "ACTIVE" }, select: { id: true } }),
        tx.userRoleAssignment.findMany({
          where: { userId: actor.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { scopeType: true, scopeId: true, role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } }
        })
      ]);
      const globalGrant = assignments.some((a) => a.scopeType === "GLOBAL" && a.scopeId === "GLOBAL" && a.role.permissions.some((p) => p.permission.key === "orders:manage"));
      const storeGrant = Boolean(activeStaff) && assignments.some((a) => a.scopeType === "STORE" && a.scopeId === current.storeId && a.role.permissions.some((p) => p.permission.key === "orders:manage"));
      if (!globalGrant && !storeGrant) throw new PermissionDeniedError();
    }

    if (current.status === VendorOrderStatus.SHIPPED && current.shipment
      && current.shipment.carrierName === data.carrierName
      && current.shipment.trackingNumber === data.trackingNumber
      && current.shipment.trackingUrl === (data.trackingUrl || null)) {
      return { id: current.shipment.id, carrierName: current.shipment.carrierName, trackingNumber: current.shipment.trackingNumber, trackingUrl: current.shipment.trackingUrl, shippedAt: current.shipment.shippedAt.toISOString(), vendorOrderStatus: VendorOrderStatus.SHIPPED, changed: false };
    }
    if (current.status !== VendorOrderStatus.READY_TO_SHIP) throw new Error("Only a ready-to-ship seller order can be dispatched.");
    if (![OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PARTIALLY_FULFILLED].includes(current.order.status)) {
      throw new Error("The parent order is not eligible for dispatch.");
    }

    const shipment = await tx.shipment.create({
      data: { vendorOrderId: id, carrierName: data.carrierName, trackingNumber: data.trackingNumber, trackingUrl: data.trackingUrl || null, shippedAt: now, createdById: actor.userId }
    });
    const changed = await tx.vendorOrder.updateMany({
      where: { id, storeId: current.storeId, status: VendorOrderStatus.READY_TO_SHIP },
      data: { status: VendorOrderStatus.SHIPPED }
    });
    if (changed.count !== 1) throw new Error("The seller order changed. Refresh and try again.");

    await tx.vendorOrderStatusHistory.create({
      data: { vendorOrderId: id, status: VendorOrderStatus.SHIPPED, note: "Seller recorded dispatch and tracking details.", actorId: actor.userId, createdAt: now }
    });

    const siblings = await tx.vendorOrder.findMany({ where: { orderId: current.orderId }, select: { status: true } });
    const dispatched = siblings.filter((item) => item.status === VendorOrderStatus.SHIPPED || item.status === VendorOrderStatus.DELIVERED).length;
    const nextParentStatus = dispatched === siblings.length ? OrderStatus.FULFILLED : dispatched > 0 ? OrderStatus.PARTIALLY_FULFILLED : current.order.status;
    if (nextParentStatus !== current.order.status) {
      const parentChanged = await tx.order.updateMany({
        where: { id: current.orderId, status: current.order.status },
        data: { status: nextParentStatus }
      });
      if (parentChanged.count === 1) {
        await tx.orderStatusHistory.create({
          data: { orderId: current.orderId, status: nextParentStatus, note: "Seller dispatch recorded.", actorId: actor.userId, createdAt: now }
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.shipment.created",
        resource: "shipment", resourceId: shipment.id, scopeType: "STORE", scopeId: current.storeId,
        occurredAt: now, metadata: { vendorOrderId: id, orderNumber: current.order.orderNumber, carrierName: data.carrierName, trackingNumber: data.trackingNumber }
      }
    });
    return { id: shipment.id, carrierName: shipment.carrierName, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl, shippedAt: shipment.shippedAt.toISOString(), vendorOrderStatus: VendorOrderStatus.SHIPPED, changed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
