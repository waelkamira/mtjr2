import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";

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
export async function getSellerCommissionHistory(storeIdInput: string) {
  const actor = await requireCurrentSession();
  const storeId = storeIdSchema.parse(storeIdInput);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, sellerId: true, seller: { select: { ownerId: true } } }
  });
  if (!store) throw new SellerCommissionStoreNotFoundError();
  if (store.seller.ownerId !== actor.userId) throw new PermissionDeniedError();

  const rows = await prisma.commissionTransaction.findMany({
    where: { storeId: store.id, sellerId: store.sellerId },
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
  });

  const totals = new Map<string, { currencyCode: string; minorUnit: number; baseAmountMinor: bigint; commissionMinor: bigint; count: number }>();
  for (const row of rows) {
    const total = totals.get(row.currencyCode) ?? {
      currencyCode: row.currencyCode,
      minorUnit: row.currency.minorUnit,
      baseAmountMinor: 0n,
      commissionMinor: 0n,
      count: 0
    };
    total.baseAmountMinor += row.baseAmountMinor;
    total.commissionMinor += row.commissionMinor;
    total.count += 1;
    totals.set(row.currencyCode, total);
  }

  return {
    store: { id: store.id, name: store.name },
    limit: 100,
    totals: [...totals.values()].map((total) => ({
      currencyCode: total.currencyCode,
      minorUnit: total.minorUnit,
      baseAmountMinor: total.baseAmountMinor.toString(),
      commissionMinor: total.commissionMinor.toString(),
      transactionCount: total.count
    })),
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
