import "server-only";

import { CheckoutQuoteStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { getCheckoutQuote } from "@/server/checkout/quotes";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

const rateInput = z.object({
  storeId: z.string().trim().min(1),
  marketId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  amountMinor: z.coerce.bigint().min(BigInt(0)).max(BigInt("9000000000000000")),
  destinationRegion: z.string().trim().max(120).optional().nullable(),
  minDeliveryDays: z.number().int().min(0).max(365).optional().nullable(),
  maxDeliveryDays: z.number().int().min(0).max(365).optional().nullable(),
  priority: z.number().int().min(0).max(10000).default(0)
}).strict().superRefine((value, ctx) => {
  if (value.minDeliveryDays != null && value.maxDeliveryDays != null && value.maxDeliveryDays < value.minDeliveryDays) {
    ctx.addIssue({ code: "custom", path: ["maxDeliveryDays"], message: "Maximum delivery days must not be less than minimum." });
  }
});

async function canManageShipping(userId: string, ownerId: string, storeId: string, now: Date) {
  if (userId === ownerId) return true;
  const [scoped, platform] = await Promise.all([
    userHasScopedPermission(userId, { permissionKey: "shipping:manage", scope: { type: "STORE", id: storeId }, now }),
    userHasPermission(userId, { permissionKey: "users:manage", now })
  ]);
  return scoped || platform;
}

export async function createStoreShippingRate(input: unknown, now = new Date()) {
  const data = rateInput.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, seller: { select: { ownerId: true, status: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || !(await canManageShipping(actor.userId, store.seller.ownerId, store.id, now))) {
      throw new Error("You do not have shipping configuration access to this store.");
    }
    const market = await tx.market.findFirst({
      where: {
        id: data.marketId, status: "ACTIVE",
        country: { is: { isActive: true } },
        storeLinks: { some: { storeId: store.id, isEnabled: true } },
        currencies: { some: { currencyCode: data.currencyCode, isEnabled: true, currency: { isActive: true } } }
      },
      select: { id: true }
    });
    if (!market) throw new Error("The store must be enabled for this active market and currency.");
    const rate = await tx.storeShippingRate.create({
      data: {
        ...data, description: data.description || null,
        destinationRegion: data.destinationRegion?.trim() || null,
        minDeliveryDays: data.minDeliveryDays ?? null,
        maxDeliveryDays: data.maxDeliveryDays ?? null
      },
      select: { id: true, storeId: true, marketId: true, currencyCode: true, name: true, description: true, amountMinor: true, destinationRegion: true, minDeliveryDays: true, maxDeliveryDays: true, isActive: true, priority: true }
    });
    await tx.auditLog.create({ data: {
      actorType: "USER", actorId: actor.userId, action: "shipping.rate.created",
      resource: "store_shipping_rate", resourceId: rate.id, scopeType: "STORE", scopeId: store.id,
      occurredAt: now, metadata: { marketId: rate.marketId, currencyCode: rate.currencyCode, amountMinor: rate.amountMinor.toString() }
    }});
    return { ...rate, amountMinor: rate.amountMinor.toString() };
  });
}

export async function updateStoreShippingRate(rateId: string, input: unknown, now = new Date()) {
  const id = z.string().trim().min(1).parse(rateId);
  const data = rateInput.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, seller: { select: { ownerId: true, status: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || !(await canManageShipping(actor.userId, store.seller.ownerId, store.id, now))) {
      throw new Error("You do not have shipping configuration access to this store.");
    }
    const market = await tx.market.findFirst({
      where: {
        id: data.marketId, status: "ACTIVE", country: { is: { isActive: true } },
        storeLinks: { some: { storeId: store.id, isEnabled: true } },
        currencies: { some: { currencyCode: data.currencyCode, isEnabled: true, currency: { isActive: true } } }
      }, select: { id: true }
    });
    if (!market) throw new Error("The store must be enabled for this active market and currency.");
    const current = await tx.storeShippingRate.findFirst({ where: { id, storeId: store.id }, select: { id: true } });
    if (!current) throw new Error("Shipping service was not found for this store.");
    const rate = await tx.storeShippingRate.update({
      where: { id },
      data: {
        marketId: data.marketId, currencyCode: data.currencyCode, name: data.name,
        description: data.description || null, amountMinor: data.amountMinor,
        destinationRegion: data.destinationRegion?.trim() || null,
        minDeliveryDays: data.minDeliveryDays ?? null, maxDeliveryDays: data.maxDeliveryDays ?? null,
        priority: data.priority
      },
      select: { id: true, storeId: true, marketId: true, currencyCode: true, name: true, description: true, amountMinor: true, destinationRegion: true, minDeliveryDays: true, maxDeliveryDays: true, isActive: true, priority: true }
    });
    await tx.auditLog.create({ data: {
      actorType: "USER", actorId: actor.userId, action: "shipping.rate.updated",
      resource: "store_shipping_rate", resourceId: rate.id, scopeType: "STORE", scopeId: store.id,
      occurredAt: now, metadata: { marketId: rate.marketId, currencyCode: rate.currencyCode, amountMinor: rate.amountMinor.toString() }
    }});
    return { ...rate, amountMinor: rate.amountMinor.toString() };
  });
}

export async function listStoreShippingRates(storeId: string, now = new Date()) {
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id: z.string().trim().min(1).parse(storeId) },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || !(await canManageShipping(actor.userId, store.seller.ownerId, store.id, now))) {
    throw new Error("You do not have shipping configuration access to this store.");
  }
  const rates = await prisma.storeShippingRate.findMany({
    where: { storeId: store.id }, orderBy: [{ priority: "asc" }, { createdAt: "desc" }], take: 200,
    select: { id: true, marketId: true, market: { select: { code: true, name: true } }, currencyCode: true, name: true, description: true, amountMinor: true, destinationRegion: true, minDeliveryDays: true, maxDeliveryDays: true, isActive: true, effectiveFrom: true, effectiveUntil: true, priority: true }
  });
  return rates.map((rate) => ({ ...rate, amountMinor: rate.amountMinor.toString() }));
}

export async function getCheckoutShippingOptions(guestToken: string, quoteId: string, now = new Date()) {
  const quote = await getCheckoutQuote(guestToken, quoteId, now);
  if (quote.status !== CheckoutQuoteStatus.ACTIVE) throw new Error("This checkout quote is no longer active.");
  const data = await prisma.checkoutQuote.findUnique({
    where: { id: quoteId },
    include: { deliveryAddress: true, lines: { select: { storeId: true, storeName: true } }, shippingSelections: true }
  });
  if (!data?.deliveryAddress) throw new Error("Save a delivery address before choosing shipping.");
  const stores = [...new Map(data.lines.map((line) => [line.storeId, line.storeName])).entries()];
  const groups = await Promise.all(stores.map(async ([storeId, storeName]) => {
    const rates = await prisma.storeShippingRate.findMany({
      where: {
        storeId, marketId: data.marketId, currencyCode: data.currencyCode, isActive: true,
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          { OR: [{ destinationRegion: null }, { destinationRegion: data.deliveryAddress?.region ?? "" }] }
        ],
        store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: { some: { marketId: data.marketId, isEnabled: true } } }
      },
      orderBy: [{ priority: "asc" }, { amountMinor: "asc" }, { name: "asc" }],
      take: 50,
      select: { id: true, name: true, description: true, amountMinor: true, destinationRegion: true, minDeliveryDays: true, maxDeliveryDays: true }
    });
    const selected = data.shippingSelections.find((item) => item.storeId === storeId);
    return {
      storeId, storeName,
      options: rates.map((rate) => ({ ...rate, amountMinor: rate.amountMinor.toString(), selected: selected?.shippingRateId === rate.id })),
      selected: selected ? { shippingRateId: selected.shippingRateId, serviceName: selected.serviceName, amountMinor: selected.amountMinor.toString(), currencyCode: selected.currencyCode } : null
    };
  }));
  return { quoteId, currency: data.currencyCode, groups };
}

export async function selectCheckoutShipping(guestToken: string, quoteId: string, input: unknown, now = new Date()) {
  const body = z.object({ storeId: z.string().trim().min(1), shippingRateId: z.string().trim().min(1) }).strict().parse(input);
  const quote = await getCheckoutQuote(guestToken, quoteId, now);
  if (quote.status !== CheckoutQuoteStatus.ACTIVE) throw new Error("This checkout quote is no longer active.");
  return prisma.$transaction(async (tx) => {
    const current = await tx.checkoutQuote.findFirst({
      where: { id: quoteId, status: CheckoutQuoteStatus.ACTIVE, expiresAt: { gt: now }, deliveryAddress: { isNot: null }, lines: { some: { storeId: body.storeId } } },
      select: { id: true, marketId: true, currencyCode: true, deliveryAddress: { select: { region: true } } }
    });
    if (!current) throw new Error("Quote, delivery address, or store is unavailable.");
    const rate = await tx.storeShippingRate.findFirst({
      where: {
        id: body.shippingRateId, storeId: body.storeId, marketId: current.marketId,
        currencyCode: current.currencyCode, isActive: true,
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          { OR: [{ destinationRegion: null }, { destinationRegion: current.deliveryAddress?.region ?? "" }] }
        ],
        store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: { some: { marketId: current.marketId, isEnabled: true } } }
      }
    });
    if (!rate) throw new Error("This shipping option is no longer eligible for the selected destination.");
    const selection = await tx.checkoutShippingSelection.upsert({
      where: { quoteId_storeId: { quoteId, storeId: body.storeId } },
      create: {
        quoteId, storeId: body.storeId, shippingRateId: rate.id, serviceName: rate.name,
        amountMinor: rate.amountMinor, currencyCode: rate.currencyCode,
        destinationRegion: current.deliveryAddress?.region ?? null,
        minDeliveryDays: rate.minDeliveryDays, maxDeliveryDays: rate.maxDeliveryDays
      },
      update: {
        shippingRateId: rate.id, serviceName: rate.name, amountMinor: rate.amountMinor,
        currencyCode: rate.currencyCode, destinationRegion: current.deliveryAddress?.region ?? null,
        minDeliveryDays: rate.minDeliveryDays, maxDeliveryDays: rate.maxDeliveryDays
      }
    });
    // Any shipping price/service change invalidates the previously calculated tax snapshot.
    await tx.checkoutTaxSnapshot.deleteMany({ where: { quoteId } });
    return { ...selection, amountMinor: selection.amountMinor.toString() };
  }, { isolationLevel: "Serializable" });
}
