import "server-only";

import { Prisma, ShipmentTrackingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.nativeEnum(ShipmentTrackingStatus).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function listAdminShipments(input: unknown, now = new Date()) {
  const filters = listSchema.parse(input);
  await requirePermission({ permissionKey: "users:manage", now });
  const q = filters.q || undefined;
  const where: Prisma.ShipmentWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(q ? {
      OR: [
        { id: q },
        { trackingNumber: { contains: q, mode: "insensitive" } },
        { carrierName: { contains: q, mode: "insensitive" } },
        {
          vendorOrder: {
            is: {
              order: {
                is: { orderNumber: { contains: q, mode: "insensitive" } }
              }
            }
          }
        },
        {
          vendorOrder: {
            is: { store: { name: { contains: q, mode: "insensitive" } } }
          }
        }
      ]
    } : {})
  };
  const [total, shipments] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      orderBy: [{ shippedAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        carrierName: true,
        trackingNumber: true,
        trackingUrl: true,
        status: true,
        shippedAt: true,
        deliveredAt: true,
        vendorOrder: {
          select: {
            id: true,
            status: true,
            store: { select: { id: true, name: true, slug: true } },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                placedAt: true,
                currencyCode: true,
                address: { select: { countryCode: true, countryName: true } }
              }
            }
          }
        },
        events: {
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: 3,
          select: { status: true, description: true, location: true, occurredAt: true }
        }
      }
    })
  ]);
  return {
    items: shipments.map((shipment) => ({
      ...shipment,
      trackingUrl: safeTrackingUrl(shipment.trackingUrl),
      shippedAt: shipment.shippedAt.toISOString(),
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
      vendorOrder: {
        ...shipment.vendorOrder,
        order: { ...shipment.vendorOrder.order, placedAt: shipment.vendorOrder.order.placedAt.toISOString() }
      },
      events: shipment.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() }))
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit),
    checkedAt: now.toISOString()
  };
}

export async function getAdminShipment(shipmentId: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(shipmentId);
  await requirePermission({ permissionKey: "users:manage", now });
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: {
      id: true,
      carrierName: true,
      trackingNumber: true,
      trackingUrl: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
      createdAt: true,
      updatedAt: true,
      vendorOrder: {
        select: {
          id: true,
          status: true,
          store: { select: { id: true, name: true, slug: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              placedAt: true,
              currencyCode: true,
              address: { select: { countryCode: true, countryName: true } }
            }
          }
        }
      },
      events: {
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        take: 100,
        select: { id: true, status: true, description: true, location: true, occurredAt: true, actorId: true }
      }
    }
  });
  if (!shipment) throw new Error("Shipment was not found.");
  return {
    ...shipment,
    trackingUrl: safeTrackingUrl(shipment.trackingUrl),
    shippedAt: shipment.shippedAt.toISOString(),
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
    vendorOrder: {
      ...shipment.vendorOrder,
      order: { ...shipment.vendorOrder.order, placedAt: shipment.vendorOrder.order.placedAt.toISOString() }
    },
    events: shipment.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
    checkedAt: now.toISOString()
  };
}
