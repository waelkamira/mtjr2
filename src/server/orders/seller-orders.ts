import "server-only";

import { AuditActorType, OrderStatus, Prisma, ShipmentTrackingStatus, VendorOrderStatus } from "@prisma/client";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";

import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const shipmentInputSchema = z.object({
  carrierName: z.string().trim().min(2).max(120),
  trackingNumber: z.string().trim().min(3).max(160),
  trackingUrl: z.string().trim().url().max(2048).optional().nullable()
    .refine((value) => {
      if (!value) return true;
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }, "Tracking links must use HTTPS and cannot include credentials.")
}).strict();

const trackingEventInputSchema = z.object({
  status: z.enum(["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"]),
  description: z.string().trim().max(500).optional(),
  location: z.string().trim().max(160).optional()
}).strict();

async function authorizeStoreOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  storeId: string,
  ownerId: string,
  now: Date
) {
  if (ownerId === userId) return;
  const [activeStaff, assignments] = await Promise.all([
    tx.sellerStaff.findFirst({
      where: { storeId, userId, status: "ACTIVE" },
      select: { id: true }
    }),
    tx.userRoleAssignment.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
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
    assignment.scopeType === "STORE" && assignment.scopeId === storeId
    && assignment.role.permissions.some(({ permission }) => permission.key === "orders:manage")
  );
  if (!hasGlobalGrant && !hasStoreGrant) throw new PermissionDeniedError();
}

async function updateParentFulfillmentStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorId: string,
  now: Date
) {
  const [order, vendorOrders] = await Promise.all([
    tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } }),
    tx.vendorOrder.findMany({ where: { orderId }, select: { status: true } })
  ]);
  const activeVendorOrders = vendorOrders.filter((vendor) => vendor.status !== VendorOrderStatus.CANCELLED);
  const shipped = activeVendorOrders.filter((vendor) =>
    vendor.status === VendorOrderStatus.SHIPPED || vendor.status === VendorOrderStatus.DELIVERED
  ).length;
  const nextStatus = activeVendorOrders.length > 0 && shipped === activeVendorOrders.length
    ? activeVendorOrders.every((vendor) => vendor.status === VendorOrderStatus.DELIVERED)
      ? OrderStatus.COMPLETED : OrderStatus.FULFILLED
    : shipped > 0 ? OrderStatus.PARTIALLY_FULFILLED : null;
  if (!nextStatus || nextStatus === order.status) return;
  const changed = await tx.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: nextStatus }
  });
  if (changed.count !== 1) throw new Error("Parent order changed while updating shipment status.");
  await tx.orderStatusHistory.create({
    data: { orderId, status: nextStatus, note: "Seller updated shipment progress.", actorId, createdAt: now }
  });
}

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
      shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } },
      items: { orderBy: { createdAt: "asc" }, select: { id: true, productName: true, sku: true, variantName: true, quantity: true, unitAmountMinor: true, lineTotalMinor: true } }
    }
  });
  return {
    orders: vendorOrders.map((vendor) => ({
      id: vendor.id, status: vendor.status, store: vendor.store,
      shippingServiceName: vendor.shippingServiceName, shippingDestinationRegion: vendor.shippingDestinationRegion,
      minDeliveryDays: vendor.minDeliveryDays, maxDeliveryDays: vendor.maxDeliveryDays,
      shipment: vendor.shipment ? {
        carrierName: vendor.shipment.carrierName, trackingNumber: vendor.shipment.trackingNumber,
        trackingUrl: vendor.shipment.trackingUrl, shippedAt: vendor.shipment.shippedAt.toISOString(),
        status: vendor.shipment.status,
        events: vendor.shipment.events.map((event) => ({
          status: event.status, description: event.description, location: event.location,
          occurredAt: event.occurredAt.toISOString()
        }))
      } : null,
      order: vendor.order,
      subtotalMinor: vendor.subtotalMinor.toString(), shippingMinor: vendor.shippingMinor.toString(),
      taxMinor: vendor.taxMinor.toString(), totalMinor: vendor.totalMinor.toString(),
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

/** A seller cannot process an order until a verified payment webhook confirms payment. */
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

    await authorizeStoreOrder(tx, actor.userId, current.storeId, current.store.seller.ownerId, now);

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

/** Seller-entered dispatch details; this does not claim carrier API verification. */
export async function createSellerShipment(vendorOrderId: string, input: unknown, now = new Date()) {
  const data = shipmentInputSchema.parse(input);
  const actor = await requireCurrentSession(now);
  const id = z.string().trim().min(1).max(128).parse(vendorOrderId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.vendorOrder.findUnique({
      where: { id },
      select: {
        id: true, orderId: true, storeId: true, status: true,
        shipment: { select: {
          id: true, carrierName: true, trackingNumber: true, trackingUrl: true, status: true, shippedAt: true,
          events: { orderBy: { occurredAt: "asc" }, select: { status: true, description: true, location: true, occurredAt: true } }
        } },
        order: { select: { status: true, orderNumber: true, userId: true } },
        store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } }
      }
    });
    if (!current) throw new Error("Seller order not found.");
    if (current.store.status !== "ACTIVE" || current.store.seller.status !== "ACTIVE") {
      throw new Error("This store is not active.");
    }
    await authorizeStoreOrder(tx, actor.userId, current.storeId, current.store.seller.ownerId, now);
    if (current.shipment && current.status === VendorOrderStatus.SHIPPED
      && current.shipment.carrierName === data.carrierName
      && current.shipment.trackingNumber === data.trackingNumber
      && current.shipment.trackingUrl === (data.trackingUrl || null)) {
      return {
        ...current.shipment, shippedAt: current.shipment.shippedAt.toISOString(),
        events: current.shipment.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
        vendorOrderStatus: VendorOrderStatus.SHIPPED, changed: false
      };
    }
    if (current.shipment) {
      throw new Error("A shipment already exists for this seller order.");
    }
    if (current.status !== VendorOrderStatus.READY_TO_SHIP) {
      throw new Error("Only seller orders marked ready to ship can be shipped.");
    }
    if (!( [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PARTIALLY_FULFILLED] as OrderStatus[]).includes(current.order.status)) {
      throw new Error("The parent order is not eligible for dispatch.");
    }

    const shipment = await tx.shipment.create({
      data: {
        vendorOrderId: id, carrierName: data.carrierName, trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl ?? null, status: ShipmentTrackingStatus.SHIPPED, shippedAt: now,
        createdById: actor.userId,
        events: { create: {
          status: ShipmentTrackingStatus.SHIPPED, description: "Shipment handed to carrier.",
          actorId: actor.userId, occurredAt: now
        } }
      },
      select: {
        id: true, carrierName: true, trackingNumber: true, trackingUrl: true, status: true, shippedAt: true,
        events: { orderBy: { occurredAt: "asc" }, select: { status: true, description: true, location: true, occurredAt: true } }
      }
    });
    const updated = await tx.vendorOrder.updateMany({
      where: { id, storeId: current.storeId, status: VendorOrderStatus.READY_TO_SHIP },
      data: { status: VendorOrderStatus.SHIPPED }
    });
    if (updated.count !== 1) throw new Error("Seller order changed while creating the shipment.");
    await tx.vendorOrderStatusHistory.create({
      data: {
        vendorOrderId: id, status: VendorOrderStatus.SHIPPED,
        note: `Shipment created with ${data.carrierName}.`, actorId: actor.userId, createdAt: now
      }
    });
    await updateParentFulfillmentStatus(tx, current.orderId, actor.userId, now);
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "seller.shipment.created", resource: "shipment", resourceId: shipment.id,
        scopeType: "STORE", scopeId: current.storeId, occurredAt: now,
        metadata: { vendorOrderId: id, orderNumber: current.order.orderNumber, carrierName: data.carrierName, trackingNumber: data.trackingNumber }
      }
    });
    if (current.order.userId) {
      await tx.notification.create({
        data: {
          userId: current.order.userId, type: "SHIPMENT_UPDATED", title: "Your order has shipped",
          message: `Seller shipment for order ${current.order.orderNumber} is on its way.`,
          resourceType: "ORDER", resourceId: current.orderId,
          deduplicationKey: `shipment:${shipment.id}:shipped`
        }
      });
    }
    return {
      ...shipment, shippedAt: shipment.shippedAt.toISOString(),
      events: shipment.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
      vendorOrderStatus: VendorOrderStatus.SHIPPED, changed: true
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function isAllowedTrackingTransition(current: ShipmentTrackingStatus, next: ShipmentTrackingStatus) {
  const allowed: Record<ShipmentTrackingStatus, ShipmentTrackingStatus[]> = {
    SHIPPED: [ShipmentTrackingStatus.IN_TRANSIT, ShipmentTrackingStatus.EXCEPTION],
    IN_TRANSIT: [ShipmentTrackingStatus.OUT_FOR_DELIVERY, ShipmentTrackingStatus.DELIVERED, ShipmentTrackingStatus.EXCEPTION],
    OUT_FOR_DELIVERY: [ShipmentTrackingStatus.DELIVERED, ShipmentTrackingStatus.EXCEPTION],
    DELIVERED: [],
    EXCEPTION: [ShipmentTrackingStatus.IN_TRANSIT, ShipmentTrackingStatus.OUT_FOR_DELIVERY, ShipmentTrackingStatus.DELIVERED]
  };
  return allowed[current].includes(next);
}

export async function addSellerShipmentTrackingEvent(vendorOrderId: string, input: unknown, now = new Date()) {
  const data = trackingEventInputSchema.parse(input);
  const actor = await requireCurrentSession(now);
  const id = z.string().trim().min(1).max(128).parse(vendorOrderId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.vendorOrder.findUnique({
      where: { id },
      select: {
        id: true, orderId: true, storeId: true, status: true,
        shipment: { select: { id: true, status: true } },
        order: { select: { orderNumber: true, userId: true } },
        store: { select: { status: true, seller: { select: { ownerId: true, status: true } } } }
      }
    });
    if (!current) throw new Error("Seller order not found.");
    if (!current.shipment) throw new Error("Create a shipment before adding tracking updates.");
    if (current.store.status !== "ACTIVE" || current.store.seller.status !== "ACTIVE") {
      throw new Error("This store is not active.");
    }
    await authorizeStoreOrder(tx, actor.userId, current.storeId, current.store.seller.ownerId, now);
    const nextStatus = data.status as ShipmentTrackingStatus;
    if (current.shipment.status === nextStatus) {
      return { id: current.shipment.id, status: current.shipment.status, changed: false };
    }
    if (!isAllowedTrackingTransition(current.shipment.status, nextStatus)) {
      throw new Error("Shipment status cannot move to the selected stage.");
    }
    await tx.shipment.update({
      where: { id: current.shipment.id },
      data: {
        status: nextStatus,
        ...(nextStatus === ShipmentTrackingStatus.DELIVERED ? { deliveredAt: now } : {})
      }
    });
    await tx.shipmentTrackingEvent.create({
      data: {
        shipmentId: current.shipment.id, status: nextStatus,
        description: data.description || null, location: data.location || null,
        actorId: actor.userId, occurredAt: now
      }
    });

    if (nextStatus === ShipmentTrackingStatus.DELIVERED) {
      const changed = await tx.vendorOrder.updateMany({
        where: { id, status: VendorOrderStatus.SHIPPED },
        data: { status: VendorOrderStatus.DELIVERED }
      });
      if (changed.count !== 1) throw new Error("Seller order changed while recording delivery.");
      await tx.vendorOrderStatusHistory.create({
        data: {
          vendorOrderId: id, status: VendorOrderStatus.DELIVERED,
          note: "Seller recorded delivery.", actorId: actor.userId, createdAt: now
        }
      });
      await updateParentFulfillmentStatus(tx, current.orderId, actor.userId, now);
    }
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "seller.shipment.tracking_updated", resource: "shipment", resourceId: current.shipment.id,
        scopeType: "STORE", scopeId: current.storeId, occurredAt: now,
        metadata: { vendorOrderId: id, orderNumber: current.order.orderNumber, status: nextStatus }
      }
    });
    if (current.order.userId) {
      await tx.notification.create({
        data: {
          userId: current.order.userId,
          type: nextStatus === ShipmentTrackingStatus.DELIVERED ? "ORDER_DELIVERED" : "SHIPMENT_UPDATED",
          title: nextStatus === ShipmentTrackingStatus.DELIVERED ? "Your order was delivered" : "Shipment tracking updated",
          message: `Seller shipment for order ${current.order.orderNumber} is ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
          resourceType: "ORDER", resourceId: current.orderId,
          deduplicationKey: `shipment:${current.shipment.id}:${nextStatus}:${now.toISOString()}`
        }
      });
    }
    return { id: current.shipment.id, status: nextStatus, changed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
