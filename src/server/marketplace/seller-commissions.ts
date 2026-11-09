import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const storeIdSchema = z.string().trim().min(1).max(128);

export class SellerCommissionStoreNotFoundError extends Error {
  constructor() {
    super("Seller store not found.");
    this.name = "SellerCommissionStoreNotFoundError";
  }
}

/**
 * Read-only commission snapshots for the owning seller.
 * These rows explain the fee recorded for each paid order item; they are not a payout balance or a general ledger.
 */
export async function getSellerCommissionHistory(storeIdInput: string, cursorInput?: string | null) {
  const actor = await requireCurrentSession();
  const storeId = storeIdSchema.parse(storeIdInput);
  const cursor = cursorInput == null ? null : z.string().trim().min(1).max(128).parse(cursorInput);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, sellerId: true, seller: { select: { ownerId: true } } }
  });
  if (!store) throw new SellerCommissionStoreNotFoundError();
  const canRead = store.seller.ownerId === actor.userId || await userHasScopedPermission(actor.userId, {
    permissionKey: "orders:read", scope: { type: "STORE", id: storeId }
  });
  if (!canRead) throw new PermissionDeniedError();

  const [rows, aggregateRows] = await Promise.all([
    prisma.commissionTransaction.findMany({
      where: { storeId: store.id, sellerId: store.sellerId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        orderId: true,
        vendorOrderId: true,
        categoryName: true,
        rateBasisPoints: true,
        baseAmountMinor: true,
        commissionMinor: true,
        currencyCode: true,
        createdAt: true,
        order: { select: { orderNumber: true, status: true } },
        orderItem: { select: { productName: true, sku: true, quantity: true } },
        currency: { select: { minorUnit: true } }
      }
    }),
    prisma.commissionTransaction.groupBy({
      by: ["currencyCode"],
      where: { storeId: store.id, sellerId: store.sellerId },
      _sum: { baseAmountMinor: true, commissionMinor: true },
      _count: { _all: true }
    })
  ]);
  const currencies = await prisma.currency.findMany({
    where: { code: { in: aggregateRows.map((row) => row.currencyCode) } },
    select: { code: true, minorUnit: true }
  });
  const minorUnits = new Map(currencies.map((currency) => [currency.code, currency.minorUnit]));
  const totals = aggregateRows.map((row) => ({
    currencyCode: row.currencyCode,
    minorUnit: minorUnits.get(row.currencyCode) ?? 2,
    baseAmountMinor: (row._sum.baseAmountMinor ?? BigInt(0)).toString(),
    commissionMinor: (row._sum.commissionMinor ?? BigInt(0)).toString(),
    transactionCount: row._count._all
  }));

  return {
    store: { id: store.id, name: store.name },
    limit: 100,
    nextCursor: rows.length === 100 ? rows[rows.length - 1]?.id ?? null : null,
    totals,
    transactions: rows.map((row) => ({
      id: row.id,
      orderNumber: row.order.orderNumber,
      orderStatus: row.order.status,
      productName: row.orderItem.productName,
      sku: row.orderItem.sku,
      quantity: row.orderItem.quantity,
      categoryName: row.categoryName,
      rateBasisPoints: row.rateBasisPoints,
      baseAmountMinor: row.baseAmountMinor.toString(),
      commissionMinor: row.commissionMinor.toString(),
      currencyCode: row.currencyCode,
      minorUnit: row.currency.minorUnit,
      createdAt: row.createdAt.toISOString()
    }))
  };
}
