import "server-only";

import { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

const idSchema = z.string().trim().min(1).max(128);

export async function listAdminOrders(input: unknown, now = new Date()) {
  const filters = listSchema.parse(input);
  await requirePermission({ permissionKey: "users:manage", now });
  const q = filters.q || undefined;
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(q ? {
      OR: [
        { id: q },
        { orderNumber: { contains: q, mode: "insensitive" } },
        { user: { is: { email: { contains: q, mode: "insensitive" } } } },
        { vendorOrders: { some: { store: { name: { contains: q, mode: "insensitive" } } } } }
      ]
    } : {})
  };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ placedAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currencyCode: true,
        currency: { select: { minorUnit: true } },
        totalMinor: true,
        placedAt: true,
        user: { select: { id: true, email: true, displayName: true } },
        _count: { select: { vendorOrders: true, payments: true } }
      }
    })
  ]);
  return {
    items: orders.map(({ _count, ...order }) => ({
      ...order,
      totalMinor: order.totalMinor.toString(),
      placedAt: order.placedAt.toISOString(),
      vendorOrderCount: _count.vendorOrders,
      paymentCount: _count.payments
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit)
  };
}

export async function getAdminOrder(orderId: string, now = new Date()) {
  const id = idSchema.parse(orderId);
  await requirePermission({ permissionKey: "users:manage", now });
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currencyCode: true,
      subtotalMinor: true,
      couponCode: true,
      discountMinor: true,
      shippingMinor: true,
      taxMinor: true,
      taxRuleName: true,
      taxRateBasisPoints: true,
      taxInclusive: true,
      taxIncludesShipping: true,
      taxDestinationRegion: true,
      totalMinor: true,
      currency: { select: { minorUnit: true } },
      placedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, displayName: true } },
      address: true,
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { status: true, note: true, createdAt: true }
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          provider: true,
          status: true,
          amountMinor: true,
          currencyCode: true,
          currency: { select: { minorUnit: true } },
          createdAt: true,
          succeededAt: true
        }
      },
      vendorOrders: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          subtotalMinor: true,
          discountMinor: true,
          shippingMinor: true,
          taxMinor: true,
          taxInclusive: true,
          shippingServiceName: true,
          shippingDestinationRegion: true,
          minDeliveryDays: true,
          maxDeliveryDays: true,
          totalMinor: true,
          createdAt: true,
          store: { select: { id: true, name: true, slug: true, seller: { select: { id: true, displayName: true, legalName: true } } } },
          items: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, productName: true, sku: true, variantName: true, quantity: true, unitAmountMinor: true, lineTotalMinor: true }
          },
          statusHistory: {
            orderBy: { createdAt: "asc" },
            select: { status: true, note: true, createdAt: true }
          },
          shipment: {
            select: {
              carrierName: true,
              trackingNumber: true,
              trackingUrl: true,
              status: true,
              shippedAt: true,
              deliveredAt: true,
              events: {
                orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
                select: { status: true, description: true, location: true, occurredAt: true }
              }
            }
          }
        }
      }
    }
  });
  if (!order) throw new Error("Order was not found.");

  return {
    ...order,
    subtotalMinor: order.subtotalMinor.toString(),
    discountMinor: order.discountMinor.toString(),
    shippingMinor: order.shippingMinor.toString(),
    taxMinor: order.taxMinor.toString(),
    totalMinor: order.totalMinor.toString(),
    placedAt: order.placedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    statusHistory: order.statusHistory.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    payments: order.payments.map((payment) => ({
      ...payment,
      amountMinor: payment.amountMinor.toString(),
      createdAt: payment.createdAt.toISOString(),
      succeededAt: payment.succeededAt?.toISOString() ?? null
    })),
    vendorOrders: order.vendorOrders.map((vendorOrder) => ({
      ...vendorOrder,
      subtotalMinor: vendorOrder.subtotalMinor.toString(),
      discountMinor: vendorOrder.discountMinor.toString(),
      shippingMinor: vendorOrder.shippingMinor.toString(),
      taxMinor: vendorOrder.taxMinor.toString(),
      totalMinor: vendorOrder.totalMinor.toString(),
      createdAt: vendorOrder.createdAt.toISOString(),
      items: vendorOrder.items.map((item) => ({
        ...item,
        unitAmountMinor: item.unitAmountMinor.toString(),
        lineTotalMinor: item.lineTotalMinor.toString()
      })),
      statusHistory: vendorOrder.statusHistory.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      shipment: vendorOrder.shipment ? {
        ...vendorOrder.shipment,
        shippedAt: vendorOrder.shipment.shippedAt.toISOString(),
        deliveredAt: vendorOrder.shipment.deliveredAt?.toISOString() ?? null,
        events: vendorOrder.shipment.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() }))
      } : null
    }))
  };
}
