import "server-only";

import { createHash } from "node:crypto";
import { CheckoutQuoteStatus, CartStatus, InventoryReservationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { getActiveCarts } from "@/server/cart/cart";

const quoteInputSchema = z.object({
  cartId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(16).max(160),
  couponCode: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/).optional()
  )
}).strict();
const quoteTtlMs = 10 * 60 * 1000;
const reservationReference = "CHECKOUT_QUOTE";

type Owner = { userId: string } | { guestSessionId: string };

function ownerWhere(owner: Owner) {
  return "userId" in owner ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function releaseQuoteReservations(tx: Prisma.TransactionClient, quoteId: string, status: CheckoutQuoteStatus, now = new Date()) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { referenceType: reservationReference, referenceId: quoteId, status: InventoryReservationStatus.ACTIVE },
    select: { id: true, inventoryId: true, quantity: true }
  });
  for (const reservation of reservations) {
    const changed = await tx.inventory.updateMany({
      where: { id: reservation.inventoryId, quantityReserved: { gte: reservation.quantity } },
      data: { quantityReserved: { decrement: reservation.quantity } }
    });
    if (changed.count !== 1) throw new Error("Inventory reservation reconciliation is required.");
    const released = await tx.inventoryReservation.updateMany({
      where: { id: reservation.id, status: InventoryReservationStatus.ACTIVE },
      data: { status: status === CheckoutQuoteStatus.EXPIRED ? InventoryReservationStatus.EXPIRED : InventoryReservationStatus.RELEASED, releasedAt: now }
    });
    if (released.count !== 1) throw new Error("Inventory reservation changed concurrently; retry checkout reconciliation.");
  }
  const changedQuote = await tx.checkoutQuote.updateMany({
    where: { id: quoteId, status: CheckoutQuoteStatus.ACTIVE },
    data: { status }
  });
  if (changedQuote.count !== 1) throw new Error("Checkout quote changed concurrently; retry checkout reconciliation.");
}

async function expireReservations(tx: Prisma.TransactionClient, now: Date) {
  const expiredQuotes = await tx.checkoutQuote.findMany({
    where: { status: CheckoutQuoteStatus.ACTIVE, expiresAt: { lte: now } },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: 100
  });
  for (const quote of expiredQuotes) {
    await releaseQuoteReservations(tx, quote.id, CheckoutQuoteStatus.EXPIRED, now);
  }
}

function serializeQuote(quote: {
  id: string; status: CheckoutQuoteStatus; market: { code: string; name: string; country?: { iso2: string; name: string } };
  currency: { code: string; symbol: string | null; minorUnit: number };
  subtotalMinor: bigint; expiresAt: Date;
  couponCode?: string | null; discountMinor?: bigint;
  deliveryAddress?: { id: string; sourceAddressId: string | null; recipientName: string; phone: string; countryCode: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } | null;
  lines: Array<{ id: string; productName: string; storeName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: bigint; lineTotalMinor: bigint }>;
}) {
  return {
    id: quote.id,
    status: quote.status,
    market: quote.market,
    currency: quote.currency,
    subtotalMinor: quote.subtotalMinor.toString(),
    couponCode: quote.couponCode ?? null,
    discountMinor: (quote.discountMinor ?? BigInt(0)).toString(),
    expiresAt: quote.expiresAt.toISOString(),
    deliveryAddress: quote.deliveryAddress ?? null,
    lines: quote.lines.map((line) => ({
      id: line.id, productName: line.productName, storeName: line.storeName,
      sku: line.sku, variantName: line.variantName, quantity: line.quantity,
      unitAmountMinor: line.unitAmountMinor.toString(), lineTotalMinor: line.lineTotalMinor.toString()
    }))
  };
}

/** Creates a ten-minute server-priced quote and atomically reserves stock across the owning store's warehouses. */
export async function createCheckoutQuote(guestToken: string, input: unknown, now = new Date()) {
  const data = quoteInputSchema.parse(input);
  const session = await getCurrentSession(now);
  // Reuse the canonical cart ownership/merge workflow before opening the quote transaction.
  await getActiveCarts(guestToken, now);
  const owner: Owner = session
    ? { userId: session.userId }
    : await prisma.guestSession.findUnique({ where: { tokenHash: hashToken(guestToken) }, select: { id: true, expiresAt: true, convertedAt: true } })
      .then((guest) => {
        if (!guest || guest.expiresAt <= now || guest.convertedAt) throw new Error("Your guest cart session has expired. Refresh the cart and try again.");
        return { guestSessionId: guest.id };
      });

  return prisma.$transaction(async (tx) => {
    await expireReservations(tx, now);
    const existingQuote = await tx.checkoutQuote.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      include: { market: { select: { code: true, name: true } }, currency: { select: { code: true, symbol: true, minorUnit: true } }, deliveryAddress: true, lines: true }
    });
    if (existingQuote) {
      if (existingQuote.cartId !== data.cartId || ("userId" in owner ? existingQuote.userId !== owner.userId : existingQuote.guestSessionId !== owner.guestSessionId)) {
        throw new Error("This idempotency key has already been used for a different checkout.");
      }
      if ((existingQuote.couponCode ?? undefined) !== data.couponCode) {
        throw new Error("This idempotency key has already been used with a different coupon.");
      }
      return serializeQuote(existingQuote);
    }

    const cart = await tx.cart.findFirst({
      where: { id: data.cartId, ...ownerWhere(owner), status: CartStatus.ACTIVE },
      include: {
        market: { select: { id: true, code: true, name: true, status: true, country: { select: { isActive: true } } } },
        currency: { select: { code: true, symbol: true, minorUnit: true, isActive: true } },
        items: {
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true, status: true, approvalStatus: true, storeId: true, store: { select: { name: true, status: true, seller: { select: { status: true } }, markets: { where: { isEnabled: true }, select: { marketId: true } } } } } },
                prices: { where: { marketId: { not: "" } }, include: { currency: { select: { minorUnit: true } } } },
                inventories: { where: { warehouse: { isActive: true } }, include: { warehouse: { select: { id: true, storeId: true } } }, orderBy: { createdAt: "asc" } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!cart || cart.items.length === 0) throw new Error("Your cart is empty or unavailable.");
    if (cart.market.status !== "ACTIVE" || !cart.market.country.isActive || !cart.currency.isActive) throw new Error("The selected market or currency is no longer available.");

    // A fresh quote replaces any prior active quote for this cart, releasing its holds first.
    const priorQuotes = await tx.checkoutQuote.findMany({
      where: { cartId: cart.id, status: CheckoutQuoteStatus.ACTIVE },
      select: { id: true }
    });
    for (const prior of priorQuotes) await releaseQuoteReservations(tx, prior.id, CheckoutQuoteStatus.RELEASED, now);

    const expiresAt = new Date(now.getTime() + quoteTtlMs);
    const quote = await tx.checkoutQuote.create({
      data: {
        cartId: cart.id, ...owner, marketId: cart.marketId, currencyCode: cart.currencyCode,
        couponCode: data.couponCode ?? null, discountMinor: BigInt(0),
        subtotalMinor: BigInt(0), idempotencyKey: data.idempotencyKey, expiresAt
      }
    });

    const quoteLines: Array<{
      variantId: string; storeId: string; productName: string; storeName: string; sku: string;
      variantName: string | null; quantity: number; unitAmountMinor: bigint; lineTotalMinor: bigint;
    }> = [];
    let subtotal = BigInt(0);

    for (const item of cart.items) {
      const variant = item.variant;
      const product = variant.product;
      const price = variant.prices.find((candidate) => candidate.marketId === cart.marketId && candidate.currencyCode === cart.currencyCode);
      const storeServesMarket = product.store.markets.some((link) => link.marketId === cart.marketId);
      if (!variant.isActive || product.status !== "ACTIVE" || product.approvalStatus !== "APPROVED" ||
          product.store.status !== "ACTIVE" || product.store.seller.status !== "ACTIVE" || !storeServesMarket || !price) {
        throw new Error("A cart item is no longer purchasable. Return to your cart and review it.");
      }

      let remaining = item.quantity;
      const inventories = variant.inventories.filter((inventory) => inventory.warehouse.storeId === product.storeId);
      for (const inventory of inventories) {
        if (remaining === 0) break;
        const available = inventory.quantityOnHand - inventory.quantityReserved - inventory.quantityQuarantined;
        const allocation = Math.min(remaining, available);
        if (allocation <= 0) continue;
        const changed = await tx.$executeRaw`UPDATE "Inventory"
          SET "quantityReserved" = "quantityReserved" + ${allocation}, "updatedAt" = ${now}
          WHERE "id" = ${inventory.id}
            AND "quantityOnHand" - "quantityReserved" - "quantityQuarantined" >= ${allocation}`;
        if (changed !== 1) throw new Error("Stock changed while creating the quote. Please try again.");
        await tx.inventoryReservation.create({
          data: {
            inventoryId: inventory.id, quantity: allocation, status: InventoryReservationStatus.ACTIVE,
            referenceType: reservationReference, referenceId: quote.id,
            idempotencyKey: `quote:${quote.id}:${inventory.id}`, expiresAt
          }
        });
        remaining -= allocation;
      }
      if (remaining > 0) throw new Error("There is not enough stock to reserve every item in your cart.");
      const unitAmountMinor = price.amountMinor;
      const lineTotalMinor = unitAmountMinor * BigInt(item.quantity);
      subtotal += lineTotalMinor;
      quoteLines.push({
        variantId: variant.id, storeId: product.storeId, productName: product.name, storeName: product.store.name,
        sku: variant.sku, variantName: variant.name, quantity: item.quantity,
        unitAmountMinor, lineTotalMinor
      });
    }

    await tx.checkoutQuoteLine.createMany({ data: quoteLines.map((line) => ({ ...line, quoteId: quote.id })) });
    let couponId: string | null = null;
    let discountMinor = BigInt(0);
    if (data.couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: data.couponCode },
        select: {
          id: true, code: true, discountType: true, value: true, currencyCode: true,
          maxRedemptions: true, startsAt: true, expiresAt: true, isActive: true
        }
      });
      if (!coupon || !coupon.isActive || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt <= now)) {
        throw new Error("This coupon code is invalid or expired.");
      }
      if (coupon.discountType === "FIXED_AMOUNT" && coupon.currencyCode !== cart.currencyCode) {
        throw new Error("This coupon is not valid for the cart currency.");
      }
      if (coupon.maxRedemptions !== null) {
        const redemptionCount = await tx.couponRedemption.count({ where: { couponId: coupon.id } });
        if (redemptionCount >= coupon.maxRedemptions) throw new Error("This coupon has reached its redemption limit.");
      }
      discountMinor = coupon.discountType === "PERCENTAGE"
        ? subtotal * coupon.value / BigInt(10000)
        : coupon.value < subtotal ? coupon.value : subtotal;
      couponId = coupon.id;
    }
    await tx.checkoutQuote.update({
      where: { id: quote.id },
      data: { subtotalMinor: subtotal, couponId, discountMinor }
    });
    const saved = await tx.checkoutQuote.findUniqueOrThrow({
      where: { id: quote.id },
      include: { market: { select: { code: true, name: true, country: { select: { iso2: true, name: true } } } }, currency: { select: { code: true, symbol: true, minorUnit: true } }, lines: { orderBy: { createdAt: "asc" } }, deliveryAddress: true }
    });
    return serializeQuote(saved);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Retrieves a quote only for its original customer or guest owner. */
export async function getCheckoutQuote(guestToken: string, quoteId: string, now = new Date()) {
  const session = await getCurrentSession(now);
  const owner: Owner = session
    ? { userId: session.userId }
    : await prisma.guestSession.findUnique({ where: { tokenHash: hashToken(guestToken) }, select: { id: true } })
      .then((guest) => {
        if (!guest) throw new Error("Checkout quote not found.");
        return { guestSessionId: guest.id };
      });
  return prisma.$transaction(async (tx) => {
    const quote = await tx.checkoutQuote.findFirst({
      where: { id: quoteId, ...ownerWhere(owner) },
      include: { market: { select: { code: true, name: true } }, currency: { select: { code: true, symbol: true, minorUnit: true } }, deliveryAddress: true, lines: { orderBy: { createdAt: "asc" } } }
    });
    if (!quote) throw new Error("Checkout quote not found.");
    if (quote.status === CheckoutQuoteStatus.ACTIVE && quote.expiresAt <= now) {
      await releaseQuoteReservations(tx, quote.id, CheckoutQuoteStatus.EXPIRED);
      quote.status = CheckoutQuoteStatus.EXPIRED;
    }
    return serializeQuote(quote);
  });
}

/** Releases an active quote and its inventory holds. */
export async function releaseCheckoutQuote(guestToken: string, quoteId: string, now = new Date()) {
  const quote = await getCheckoutQuote(guestToken, quoteId, now);
  if (quote.status !== CheckoutQuoteStatus.ACTIVE) return { released: false, status: quote.status };
  await prisma.$transaction(async (tx) => releaseQuoteReservations(tx, quoteId, CheckoutQuoteStatus.RELEASED, now), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
  return { released: true, status: CheckoutQuoteStatus.RELEASED };
}

/** Bounded scheduled cleanup; releases expired holds without requiring a shopper request. */
export async function expireDueCheckoutQuotes(now = new Date(), batchSize = 100) {
  const limit = z.number().int().min(1).max(500).parse(batchSize);
  return prisma.$transaction(async (tx) => {
    const due = await tx.checkoutQuote.findMany({
      where: { status: CheckoutQuoteStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: limit
    });
    for (const quote of due) {
      await releaseQuoteReservations(tx, quote.id, CheckoutQuoteStatus.EXPIRED, now);
    }
    return { expiredQuotes: due.length, processedAt: now.toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
