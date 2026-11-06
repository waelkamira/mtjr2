import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const filterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  sellerId: z.string().trim().min(1).max(128).optional(),
  storeId: z.string().trim().min(1).max(128).optional()
}).strict();

function parseUtcDay(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Dashboard dates must be valid calendar days.");
  }
  return date;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAdminDashboard(input: unknown, now = new Date()) {
  const filters = filterSchema.parse(input);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = filters.from ? parseUtcDay(filters.from) : new Date(today.getTime() - 29 * 86_400_000);
  const toDay = filters.to ? parseUtcDay(filters.to) : today;
  const toExclusive = new Date(toDay.getTime() + 86_400_000);
  const duration = toExclusive.getTime() - from.getTime();

  if (from >= toExclusive || duration > 366 * 86_400_000) {
    throw new Error("Choose a date range of up to 366 days.");
  }

  await requirePermission({ permissionKey: "users:manage", now });

  const [country, currency, seller, store] = await Promise.all([
    filters.countryCode
      ? prisma.country.findFirst({ where: { iso2: filters.countryCode }, select: { iso2: true } })
      : Promise.resolve(null),
    filters.currencyCode
      ? prisma.currency.findFirst({ where: { code: filters.currencyCode }, select: { code: true } })
      : Promise.resolve(null),
    filters.sellerId
      ? prisma.seller.findUnique({ where: { id: filters.sellerId }, select: { id: true } })
      : Promise.resolve(null),
    filters.storeId
      ? prisma.store.findUnique({ where: { id: filters.storeId }, select: { id: true, sellerId: true } })
      : Promise.resolve(null)
  ]);
  if (filters.countryCode && !country) throw new Error("The selected country is not available.");
  if (filters.currencyCode && !currency) throw new Error("The selected currency is not available.");
  if (filters.sellerId && !seller) throw new Error("The selected seller was not found.");
  if (filters.storeId && !store) throw new Error("The selected store was not found.");
  if (filters.sellerId && store && store.sellerId !== filters.sellerId) {
    throw new Error("The selected store does not belong to that seller.");
  }

  const baseOrderWhere = {
    ...(filters.countryCode ? { address: { is: { countryCode: filters.countryCode } } } : {}),
    ...(filters.currencyCode ? { currencyCode: filters.currencyCode } : {}),
    ...((filters.sellerId || filters.storeId)
      ? {
          vendorOrders: {
            some: {
              ...(filters.storeId ? { storeId: filters.storeId } : {}),
              ...(filters.sellerId ? { store: { sellerId: filters.sellerId } } : {})
            }
          }
        }
      : {})
  } satisfies Prisma.OrderWhereInput;
  const orderWhere = {
    ...baseOrderWhere,
    placedAt: { gte: from, lt: toExclusive }
  } satisfies Prisma.OrderWhereInput;
  const previousFrom = new Date(from.getTime() - duration);
  const previousTo = from;
  const previousOrderWhere = {
    ...baseOrderWhere,
    placedAt: { gte: previousFrom, lt: previousTo }
  } satisfies Prisma.OrderWhereInput;

  const [activeUsers, newUsers, activeSellers, pendingSellers, activeStores, suspendedStores,
    totalProducts, pendingProducts, orderStatuses, previousOrders, orderValues, paymentStatuses,
    paymentValues, pendingProductReviews, pendingStoreReviews, requestedReturns, openSupportTickets,
    countries, currencies, sellers, stores, recentOrders, dailyOrderRows] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { createdAt: { gte: from, lt: toExclusive } } }),
    prisma.seller.count({ where: { status: "ACTIVE" } }),
    prisma.seller.count({ where: { status: "PENDING" } }),
    prisma.store.count({ where: { status: "ACTIVE" } }),
    prisma.store.count({ where: { status: "SUSPENDED" } }),
    prisma.product.count(),
    prisma.product.count({ where: { approvalStatus: "PENDING" } }),
    prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true } }),
    prisma.order.count({ where: previousOrderWhere }),
    prisma.order.groupBy({
      by: ["currencyCode"],
      where: { ...orderWhere, status: { not: "CANCELLED" } },
      _sum: { totalMinor: true }
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where: { order: { is: orderWhere } },
      _count: { _all: true }
    }),
    prisma.payment.groupBy({
      by: ["currencyCode"],
      where: { status: "SUCCEEDED", order: { is: orderWhere } },
      _sum: { amountMinor: true }
    }),
    prisma.productReview.count({ where: { status: "PENDING" } }),
    prisma.storeReview.count({ where: { status: "PENDING" } }),
    prisma.returnRequest.count({ where: { status: "REQUESTED" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, select: { iso2: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: "asc" }, select: { code: true, name: true, minorUnit: true } }),
    prisma.seller.findMany({
      orderBy: { displayName: "asc" }, take: 200,
      select: { id: true, displayName: true, legalName: true }
    }),
    prisma.store.findMany({
      orderBy: { name: "asc" }, take: 500,
      select: { id: true, name: true, sellerId: true }
    }),
    prisma.order.findMany({
      where: orderWhere, orderBy: [{ placedAt: "desc" }, { id: "desc" }], take: 8,
      select: { id: true, orderNumber: true, status: true, totalMinor: true, currencyCode: true, placedAt: true }
    }),
    loadDailyOrderCounts(from, toExclusive, filters)
  ]);

  const counts = new Map(orderStatuses.map((row) => [row.status, row._count._all]));
  const paymentCounts = new Map(paymentStatuses.map((row) => [row.status, row._count._all]));
  const includedDays = Math.round(duration / 86_400_000);
  const dailyCounts = new Map(dailyOrderRows.map((row) => [formatDay(row.day), row.orderCount]));
  const dailyOrders = Array.from({ length: includedDays }, (_, index) => {
    const date = new Date(from.getTime() + index * 86_400_000);
    const day = formatDay(date);
    return { day, count: dailyCounts.get(day) ?? 0 };
  });

  return {
    filters: {
      from: formatDay(from),
      to: formatDay(new Date(toExclusive.getTime() - 86_400_000)),
      countryCode: filters.countryCode ?? "",
      currencyCode: filters.currencyCode ?? "",
      sellerId: filters.sellerId ?? "",
      storeId: filters.storeId ?? "",
      countries,
      currencies,
      sellers: sellers.map((item) => ({
        id: item.id,
        name: item.displayName || item.legalName || item.id
      })),
      stores
    },
    metrics: {
      activeUsers,
      newUsers,
      activeSellers,
      pendingSellers,
      activeStores,
      suspendedStores,
      totalProducts,
      pendingProducts,
      totalOrders: [...counts.values()].reduce((sum, count) => sum + count, 0),
      pendingOrders: counts.get("PENDING_PAYMENT") ?? 0,
      processingOrders: (counts.get("CONFIRMED") ?? 0) + (counts.get("PROCESSING") ?? 0) + (counts.get("PARTIALLY_FULFILLED") ?? 0),
      completedOrders: (counts.get("FULFILLED") ?? 0) + (counts.get("COMPLETED") ?? 0),
      previousPeriodOrders: previousOrders,
      grossOrderValueByCurrency: orderValues.map((row) => ({
        currencyCode: row.currencyCode,
        amountMinor: (row._sum.totalMinor ?? BigInt(0)).toString()
      })),
      successfulPayments: paymentCounts.get("SUCCEEDED") ?? 0,
      failedPayments: paymentCounts.get("FAILED") ?? 0,
      pendingPayments: (paymentCounts.get("INITIATING") ?? 0) + (paymentCounts.get("REQUIRES_ACTION") ?? 0) + (paymentCounts.get("PROCESSING") ?? 0),
      successfulPaymentAmountByCurrency: paymentValues.map((row) => ({
        currencyCode: row.currencyCode,
        amountMinor: (row._sum.amountMinor ?? BigInt(0)).toString()
      })),
      pendingProductReviews,
      pendingStoreReviews,
      requestedReturns,
      openSupportTickets
    },
    orderStatusCounts: [...counts.entries()].map(([status, count]) => ({ status, count })),
    dailyOrders,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      totalMinor: order.totalMinor.toString(),
      placedAt: order.placedAt.toISOString()
    })),
    unavailableMetrics: {
      marketplaceRevenue: "No posted commission or accounting-ledger workflow is available.",
      sellerPayables: "No payout or seller-settlement workflow is available.",
      refundsAndDisputes: "Refund and dispute persistence is not available.",
      operationalHealth: "No centralized integration or infrastructure health checks are available."
    }
  };
}

async function loadDailyOrderCounts(
  from: Date,
  toExclusive: Date,
  filters: z.infer<typeof filterSchema>
): Promise<Array<{ day: Date; orderCount: number }>> {
  const conditions = [
    Prisma.sql`o."placedAt" >= ${from}`,
    Prisma.sql`o."placedAt" < ${toExclusive}`
  ];
  if (filters.countryCode) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "OrderAddress" oa
      WHERE oa."orderId" = o.id AND oa."countryCode" = ${filters.countryCode}
    )`);
  }
  if (filters.currencyCode) conditions.push(Prisma.sql`o."currencyCode" = ${filters.currencyCode}`);
  if (filters.storeId || filters.sellerId) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "VendorOrder" vo
      JOIN "Store" s ON s.id = vo."storeId"
      WHERE vo."orderId" = o.id
      ${filters.storeId ? Prisma.sql`AND vo."storeId" = ${filters.storeId}` : Prisma.empty}
      ${filters.sellerId ? Prisma.sql`AND s."sellerId" = ${filters.sellerId}` : Prisma.empty}
    )`);
  }
  return prisma.$queryRaw<Array<{ day: Date; orderCount: number }>>(Prisma.sql`
    SELECT date_trunc('day', o."placedAt" AT TIME ZONE 'UTC') AS day,
      COUNT(*) FILTER (WHERE o.status <> 'CANCELLED')::int AS "orderCount"
    FROM "Order" o
    WHERE ${Prisma.join(conditions, " AND ")}
    GROUP BY 1
    ORDER BY 1
  `);
}
