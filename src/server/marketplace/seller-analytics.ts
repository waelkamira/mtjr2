import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PermissionDeniedError, requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

const SALE_STATUSES = ["CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"] as const;

export type SellerAnalyticsRange = { storeId: string; from?: string; to?: string };

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid analytics date.");
  }
  return date;
}

export async function getSellerDashboardAnalytics(input: SellerAnalyticsRange) {
  const actor = await requireCurrentSession();
  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, name: true, status: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE") throw new PermissionDeniedError("The seller store is unavailable.");

  const isOwner = store.seller.ownerId === actor.userId;
  const isPlatformAdmin = await userHasPermission(actor.userId, { permissionKey: "users:manage" });
  const staffMembership = isOwner || isPlatformAdmin ? true : Boolean(await prisma.sellerStaff.findFirst({
    where: { storeId: store.id, userId: actor.userId, status: "ACTIVE" },
    select: { id: true }
  }));

  if (!isOwner && !isPlatformAdmin && !staffMembership) {
    throw new PermissionDeniedError("You do not have access to this store.");
  }

  const scope = { type: "STORE" as const, id: store.id };
  const [ordersPermission, catalogPermission, inventoryPermission, reviewsPermission, returnsPermission, storePermission] =
    isOwner || isPlatformAdmin
      ? [true, true, true, true, true, true]
      : await Promise.all([
        userHasScopedPermission(actor.userId, { permissionKey: "orders:read", scope }),
        userHasScopedPermission(actor.userId, { permissionKey: "catalog:read", scope }),
        userHasScopedPermission(actor.userId, { permissionKey: "inventory:manage", scope }),
        userHasScopedPermission(actor.userId, { permissionKey: "reviews:manage", scope }),
        userHasScopedPermission(actor.userId, { permissionKey: "returns:manage", scope }),
        userHasScopedPermission(actor.userId, { permissionKey: "store:read", scope })
      ]);

  if (![ordersPermission, catalogPermission, inventoryPermission, reviewsPermission, returnsPermission, storePermission].some(Boolean)) {
    throw new PermissionDeniedError("You do not have permission to view this store dashboard.");
  }

  const today = new Date();
  const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const from = parseDate(input.from, defaultFrom);
  const toStart = parseDate(input.to, defaultTo);
  if (toStart < from) throw new Error("The analytics end date must not be before the start date.");
  const days = Math.floor((toStart.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > 90) throw new Error("The analytics range cannot exceed 90 days.");
  const toExclusive = new Date(toStart.getTime() + 86_400_000);

  const orderWhere = {
    storeId: store.id,
    status: { in: [...SALE_STATUSES] },
    order: { placedAt: { gte: from, lt: toExclusive } }
  };

  const [orderCount, statusGroups, salesRows, dailyRows, topProducts, activeProducts, pendingProducts, reviewAggregate, requestedReturns] =
    await Promise.all([
      ordersPermission ? prisma.vendorOrder.count({ where: orderWhere }) : Promise.resolve(0),
      ordersPermission ? prisma.vendorOrder.groupBy({
        by: ["status"],
        where: orderWhere,
        _count: { _all: true }
      }) : Promise.resolve([]),
      ordersPermission ? prisma.$queryRaw<Array<{ currencyCode: string; amountMinor: bigint; orderCount: bigint }>>(Prisma.sql`
        SELECT o."currencyCode" AS "currencyCode",
               SUM(vo."totalMinor") AS "amountMinor",
               COUNT(*)::bigint AS "orderCount"
        FROM "VendorOrder" vo
        INNER JOIN "Order" o ON o."id" = vo."orderId"
        WHERE vo."storeId" = ${store.id}
          AND vo."status" IN ('CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED')
          AND o."placedAt" >= ${from}
          AND o."placedAt" < ${toExclusive}
        GROUP BY o."currencyCode"
        ORDER BY o."currencyCode"
      `) : Promise.resolve([]),
      ordersPermission ? prisma.$queryRaw<Array<{ day: Date; currencyCode: string; amountMinor: bigint; orderCount: bigint }>>(Prisma.sql`
        SELECT date_trunc('day', o."placedAt")::date AS "day",
               o."currencyCode" AS "currencyCode",
               SUM(vo."totalMinor") AS "amountMinor",
               COUNT(*)::bigint AS "orderCount"
        FROM "VendorOrder" vo
        INNER JOIN "Order" o ON o."id" = vo."orderId"
        WHERE vo."storeId" = ${store.id}
          AND vo."status" IN ('CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED')
          AND o."placedAt" >= ${from}
          AND o."placedAt" < ${toExclusive}
        GROUP BY 1, 2
        ORDER BY 1, 2
      `) : Promise.resolve([]),
      ordersPermission ? prisma.orderItem.groupBy({
        by: ["productId", "productName"],
        where: {
          vendorOrder: {
            storeId: store.id,
            status: { in: [...SALE_STATUSES] },
            order: { placedAt: { gte: from, lt: toExclusive } }
          }
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8
      }) : Promise.resolve([]),
      catalogPermission ? prisma.product.count({ where: { storeId: store.id, status: "ACTIVE", approvalStatus: "APPROVED" } }) : Promise.resolve(null),
      catalogPermission ? prisma.product.count({ where: { storeId: store.id, approvalStatus: "PENDING" } }) : Promise.resolve(null),
      reviewsPermission ? prisma.storeReview.aggregate({
        where: { storeId: store.id, status: "PUBLISHED" },
        _avg: { rating: true },
        _count: { _all: true }
      }) : Promise.resolve(null),
      returnsPermission ? prisma.returnRequest.count({
        where: {
          status: "REQUESTED",
          items: { some: { orderItem: { vendorOrder: { storeId: store.id } } } }
        }
      }) : Promise.resolve(null)
    ]);

  const currencyCodes = [...new Set(salesRows.map((row) => row.currencyCode))];
  const currencies = currencyCodes.length ? await prisma.currency.findMany({
    where: { code: { in: currencyCodes } },
    select: { code: true, name: true, minorUnit: true, symbol: true }
  }) : [];
  const currencyMap = new Map(currencies.map((currency) => [currency.code, currency]));

  return {
    store: { id: store.id, name: store.name },
    range: { from: from.toISOString().slice(0, 10), to: toStart.toISOString().slice(0, 10), days },
    permissions: {
      orders: ordersPermission,
      catalog: catalogPermission,
      inventory: inventoryPermission,
      reviews: reviewsPermission,
      returns: returnsPermission,
      store: storePermission
    },
    metrics: {
      totalOrders: ordersPermission ? orderCount : null,
      grossSalesByCurrency: salesRows.map((row) => ({
        currencyCode: row.currencyCode,
        amountMinor: row.amountMinor.toString(),
        orderCount: Number(row.orderCount),
        minorUnit: currencyMap.get(row.currencyCode)?.minorUnit ?? 2,
        currencyName: currencyMap.get(row.currencyCode)?.name ?? row.currencyCode
      })),
      activeProducts,
      pendingProducts,
      averageRating: reviewAggregate?._avg.rating ?? null,
      reviewCount: reviewAggregate?._count._all ?? null,
      requestedReturns
    },
    orderStatuses: statusGroups.map((row) => ({ status: row.status, count: row._count._all })),
    dailySales: dailyRows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      currencyCode: row.currencyCode,
      amountMinor: row.amountMinor.toString(),
      orderCount: Number(row.orderCount)
    })),
    topProducts: topProducts.map((row) => ({
      productId: row.productId,
      name: row.productName,
      unitsSold: row._sum.quantity ?? 0
    }))
  };
}
