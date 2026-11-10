import "server-only";

import { CheckoutQuoteStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission } from "@/server/identity/permission-repository";
import { getCheckoutQuote } from "@/server/checkout/quotes";

const rateInput = z.object({
  marketId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  destinationRegion: z.string().trim().max(120).nullable().optional(),
  rateBasisPoints: z.number().int().min(0).max(100000),
  isInclusive: z.boolean().default(false),
  appliesToShipping: z.boolean().default(false),
  priority: z.number().int().min(0).max(10000).default(0),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveUntil: z.coerce.date().optional().nullable()
}).strict().superRefine((value, ctx) => {
  if (value.effectiveFrom && value.effectiveUntil && value.effectiveUntil <= value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveUntil"], message: "End date must be after start date." });
  }
});

async function requireTaxAdmin(now: Date) {
  const actor = await requireCurrentSession(now);
  if (!(await userHasPermission(actor.userId, { permissionKey: "users:manage", now }))) {
    throw new Error("Tax configuration requires platform administration permission.");
  }
  return actor;
}

export async function createMarketTaxRate(input: unknown, now = new Date()) {
  const data = rateInput.parse(input);
  const actor = await requireTaxAdmin(now);
  return prisma.$transaction(async (tx) => {
    const market = await tx.market.findFirst({ where: { id: data.marketId, status: "ACTIVE" }, select: { id: true } });
    if (!market) throw new Error("An active market is required for tax configuration.");
    const rate = await tx.marketTaxRate.create({
      data: { ...data, destinationRegion: data.destinationRegion?.trim() || null },
      select: { id: true, marketId: true, name: true, destinationRegion: true, rateBasisPoints: true, isInclusive: true, appliesToShipping: true, isActive: true, effectiveFrom: true, effectiveUntil: true, priority: true }
    });
    await tx.auditLog.create({ data: {
      actorType: "USER", actorId: actor.userId, action: "tax.market_rate.created",
      resource: "market_tax_rate", resourceId: rate.id, scopeType: "MARKET", scopeId: market.id,
      occurredAt: now, metadata: { rateBasisPoints: rate.rateBasisPoints, isInclusive: rate.isInclusive, destinationRegion: rate.destinationRegion }
    }});
    return rate;
  });
}

export async function listMarketTaxRates(now = new Date()) {
  await requireTaxAdmin(now);
  return prisma.marketTaxRate.findMany({
    orderBy: [{ market: { name: "asc" } }, { priority: "asc" }, { destinationRegion: "asc" }],
    take: 500,
    select: { id: true, market: { select: { id: true, code: true, name: true } }, name: true, destinationRegion: true, rateBasisPoints: true, isInclusive: true, appliesToShipping: true, isActive: true, effectiveFrom: true, effectiveUntil: true, priority: true }
  });
}

/** Calculates and snapshots the market/region tax for an active quote; never guesses an unconfigured rate. */
export async function calculateCheckoutTax(guestToken: string, quoteId: string, now = new Date()) {
  const ownedQuote = await getCheckoutQuote(guestToken, quoteId, now);
  if (ownedQuote.status !== CheckoutQuoteStatus.ACTIVE) throw new Error("This checkout quote is no longer active.");
  return prisma.$transaction(async (tx) => {
    const quote = await tx.checkoutQuote.findFirst({
      where: { id: quoteId, status: CheckoutQuoteStatus.ACTIVE, expiresAt: { gt: now }, deliveryAddress: { isNot: null } },
      include: { deliveryAddress: true, lines: { select: { storeId: true } }, shippingSelections: true, currency: { select: { minorUnit: true } } }
    });
    if (!quote?.deliveryAddress) throw new Error("A delivery address is required before tax can be calculated.");
    const storeIds = [...new Set(quote.lines.map((line) => line.storeId))];
    const representedStores = new Set(storeIds);
    const selectedStores = new Set(quote.shippingSelections.map((selection) => selection.storeId));
    const hasCompleteShipping = storeIds.every((storeId) => selectedStores.has(storeId))
      && quote.shippingSelections.every((selection) =>
        representedStores.has(selection.storeId) && selection.currencyCode === quote.currencyCode
      );
    if (!hasCompleteShipping) {

      return { configured: false, requiresShippingSelection: true, message: "Choose a shipping service for every seller before calculating tax." };
    }
    const region = quote.deliveryAddress.region?.trim() || null;
    const rates = await tx.marketTaxRate.findMany({
      where: {
        marketId: quote.marketId, isActive: true,
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          { OR: [{ destinationRegion: null }, { destinationRegion: region ?? "" }] }
        ]
      },
      orderBy: [{ destinationRegion: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
      take: 20
    });
    const rate = rates.find((item) => item.destinationRegion === region) ?? rates.find((item) => item.destinationRegion === null);
    if (!rate) {
      await tx.checkoutTaxSnapshot.deleteMany({ where: { quoteId } });
      return { configured: false, requiresShippingSelection: false, message: "Tax has not been configured for this market and destination. No tax amount is assumed." };
    }
    const shippingMinor = quote.shippingSelections.reduce((sum, item) => sum + item.amountMinor, BigInt(0));
    const discountedSubtotal = quote.subtotalMinor - quote.discountMinor;
    if (discountedSubtotal < BigInt(0)) throw new Error("Checkout discount exceeds the merchandise subtotal.");
    const taxableAmount = discountedSubtotal + (rate.appliesToShipping ? shippingMinor : BigInt(0));
    const basis = BigInt(rate.rateBasisPoints);
    const denominator = BigInt(10000);
    const taxAmount = rate.isInclusive
      ? (taxableAmount * basis + (denominator + basis) / BigInt(2)) / (denominator + basis)
      : (taxableAmount * basis + denominator / BigInt(2)) / denominator;
    const snapshot = await tx.checkoutTaxSnapshot.upsert({
      where: { quoteId },
      create: {
        quoteId, taxRateId: rate.id, ruleName: rate.name, rateBasisPoints: rate.rateBasisPoints,
        taxableAmountMinor: taxableAmount, taxAmountMinor: taxAmount, currencyCode: quote.currencyCode,
        isInclusive: rate.isInclusive, includesShipping: rate.appliesToShipping, destinationRegion: region
      },
      update: {
        taxRateId: rate.id, ruleName: rate.name, rateBasisPoints: rate.rateBasisPoints,
        taxableAmountMinor: taxableAmount, taxAmountMinor: taxAmount, currencyCode: quote.currencyCode,
        isInclusive: rate.isInclusive, includesShipping: rate.appliesToShipping, destinationRegion: region
      }
    });
    const totalShipping = shippingMinor;
    const amountDue = discountedSubtotal + totalShipping + (rate.isInclusive ? BigInt(0) : taxAmount);
    return {
      configured: true,
      rule: { name: rate.name, rateBasisPoints: rate.rateBasisPoints, isInclusive: rate.isInclusive, includesShipping: rate.appliesToShipping },
      subtotalMinor: quote.subtotalMinor.toString(),
      couponCode: quote.couponCode,
      discountMinor: quote.discountMinor.toString(),
      shippingMinor: totalShipping.toString(),
      taxableAmountMinor: snapshot.taxableAmountMinor.toString(),
      taxAmountMinor: snapshot.taxAmountMinor.toString(),
      amountDueMinor: amountDue.toString(),
      currencyCode: quote.currencyCode,
      minorUnit: quote.currency.minorUnit
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
