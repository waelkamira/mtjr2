import "server-only";

import { createHash } from "node:crypto";
import { CartStatus, CatalogEntityStatus, ProductApprovalStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";

const guestTtlMs = 30 * 24 * 60 * 60 * 1000;
const quantitySchema = z.number().int().min(1).max(99);
const addSchema = z.object({
  marketId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  variantId: z.string().trim().min(1),
  quantity: quantitySchema.default(1)
}).strict();
const addManySchema = z.object({
  marketId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  items: z.array(z.object({
    variantId: z.string().trim().min(1),
    quantity: quantitySchema
  }).strict()).min(1).max(500)
}).strict();

export type AddCartItemInput = z.input<typeof addSchema>;

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureGuestSession(tx: Prisma.TransactionClient, token: string, now: Date) {
  const tokenHash = hashGuestToken(token);
  const session = await tx.guestSession.upsert({
    where: { tokenHash },
    create: { tokenHash, expiresAt: new Date(now.getTime() + guestTtlMs) },
    update: {}
  });
  if (session.expiresAt <= now || session.convertedAt) {
    return tx.guestSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(now.getTime() + guestTtlMs), convertedAt: null }
    });
  }
  return session;
}

async function getOrCreateOwnerCart(
  tx: Prisma.TransactionClient,
  owner: { userId: string } | { guestSessionId: string },
  marketId: string,
  currencyCode: string
) {
  const where = "userId" in owner
    ? { userId_marketId_currencyCode_status: { userId: owner.userId, marketId, currencyCode, status: CartStatus.ACTIVE } }
    : { guestSessionId_marketId_currencyCode_status: { guestSessionId: owner.guestSessionId, marketId, currencyCode, status: CartStatus.ACTIVE } };
  return tx.cart.upsert({
    where,
    create: { ...owner, marketId, currencyCode, status: CartStatus.ACTIVE },
    update: {}
  });
}

async function mergeGuestCarts(
  tx: Prisma.TransactionClient,
  userId: string,
  guestToken: string,
  now: Date
) {
  const guest = await tx.guestSession.findUnique({ where: { tokenHash: hashGuestToken(guestToken) } });
  if (!guest || guest.expiresAt <= now || guest.convertedAt) return;
  // Claim the merge once. Concurrent requests cannot increment customer quantities twice.
  const claimed = await tx.guestSession.updateMany({
    where: { id: guest.id, convertedAt: null, expiresAt: { gt: now } },
    data: { convertedAt: now }
  });
  if (claimed.count !== 1) return;
  const carts = await tx.cart.findMany({
    where: { guestSessionId: guest.id, status: CartStatus.ACTIVE },
    include: { items: true }
  });
  for (const guestCart of carts) {
    const userCart = await getOrCreateOwnerCart(tx, { userId }, guestCart.marketId, guestCart.currencyCode);
    for (const item of guestCart.items) {
      const current = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } }
      });
      if (current) {
        await tx.cartItem.update({
          where: { id: current.id },
          data: { quantity: Math.min(99, current.quantity + item.quantity) }
        });
      } else {
        await tx.cartItem.create({
          data: { cartId: userCart.id, variantId: item.variantId, quantity: item.quantity }
        });
      }
    }
    await tx.cart.update({ where: { id: guestCart.id }, data: { status: CartStatus.MERGED } });
  }
}

async function resolveOwner(
  tx: Prisma.TransactionClient,
  guestToken: string,
  now: Date
) {
  const session = await getCurrentSession(now);
  if (session) {
    await mergeGuestCarts(tx, session.userId, guestToken, now);
    return { userId: session.userId } as const;
  }
  const guest = await ensureGuestSession(tx, guestToken, now);
  return { guestSessionId: guest.id } as const;
}

async function getAvailableStock(tx: Prisma.TransactionClient, variantId: string, storeId: string) {
  const rows = await tx.inventory.findMany({
    where: { variantId, warehouse: { isActive: true, storeId } },
    select: { quantityOnHand: true, quantityReserved: true, quantityQuarantined: true }
  });
  return rows.reduce((total, row) => total + row.quantityOnHand - row.quantityReserved - row.quantityQuarantined, 0);
}

async function validatePurchasableVariant(
  tx: Prisma.TransactionClient,
  variantId: string,
  marketId: string,
  currencyCode: string
) {
  const market = await tx.market.findFirst({
    where: {
      id: marketId,
      status: "ACTIVE",
      country: { isActive: true },
      currencies: { some: { currencyCode, isEnabled: true, currency: { isActive: true } } }
    },
    select: { id: true }
  });
  if (!market) throw new Error("The selected delivery market or currency is unavailable.");

  const variant = await tx.productVariant.findFirst({
    where: {
      id: variantId,
      isActive: true,
      product: {
        status: CatalogEntityStatus.ACTIVE,
        approvalStatus: ProductApprovalStatus.APPROVED,
        store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: { some: { marketId, isEnabled: true } } }
      },
      prices: { some: { marketId, currencyCode } }
    },
    select: {
      id: true,
      prices: {
        where: { marketId, currencyCode },
        select: { amountMinor: true, compareAtMinor: true, currency: { select: { minorUnit: true } } },
        take: 1
      },
      product: {
        select: {
          id: true, slug: true, name: true, storeId: true,
          store: { select: { name: true, slug: true } },
          media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, altText: true } }
        }
      }
    }
  });
  if (!variant || !variant.prices[0]) throw new Error("This product option is no longer available for the selected market.");
  return { variant, available: await getAvailableStock(tx, variantId, variant.product.storeId) };
}

function ownerFilter(owner: { userId: string } | { guestSessionId: string }) {
  return "userId" in owner ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId };
}

/** Returns the current owner's active carts with server-resolved prices and stock. */
export async function getActiveCarts(guestToken: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const owner = await resolveOwner(tx, guestToken, now);
    const carts = await tx.cart.findMany({
      where: { ...ownerFilter(owner), status: CartStatus.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        market: { select: { id: true, code: true, name: true } },
        currency: { select: { code: true, symbol: true, minorUnit: true } },
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            variant: {
              select: {
                id: true, sku: true, name: true,
                product: {
                  select: {
                    id: true, slug: true, name: true, storeId: true,
                    store: { select: { name: true, slug: true } },
                    media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, altText: true } }
                  }
                },
                prices: {
                  where: { marketId: { not: "" } },
                  select: { marketId: true, currencyCode: true, amountMinor: true, compareAtMinor: true, currency: { select: { minorUnit: true } } }
                },
                inventories: { where: { warehouse: { isActive: true } }, select: { quantityOnHand: true, quantityReserved: true, quantityQuarantined: true, warehouse: { select: { storeId: true } } } }
              }
            }
          }
        }
      }
    });
    return carts.map((cart) => ({
      id: cart.id,
      market: cart.market,
      currency: cart.currency,
      items: cart.items.map((item) => {
        const price = item.variant.prices.find((candidate) => candidate.marketId === cart.marketId && candidate.currencyCode === cart.currencyCode);
        const availableQuantity = item.variant.inventories.filter((stock) => stock.warehouse.storeId === item.variant.product.storeId).reduce((total, stock) => total + stock.quantityOnHand - stock.quantityReserved - stock.quantityQuarantined, 0);
        return {
          id: item.id, quantity: item.quantity,
          variant: {
            id: item.variant.id, sku: item.variant.sku, name: item.variant.name,
            product: { id: item.variant.product.id, slug: item.variant.product.slug, name: item.variant.product.name, store: item.variant.product.store, media: item.variant.product.media }
          },
          price: price ? {
            amountMinor: price.amountMinor.toString(),
            compareAtMinor: price.compareAtMinor?.toString() ?? null,
            currencyCode: price.currencyCode,
            minorUnit: price.currency.minorUnit
          } : null,
          availableQuantity
        };
      })
    }));
  });
}

/** Adds a purchasable variant after validating market, current price and stock on the server. */
export async function addCartItem(guestToken: string, input: AddCartItemInput, now = new Date()) {
  const data = addSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const owner = await resolveOwner(tx, guestToken, now);
    const { available } = await validatePurchasableVariant(tx, data.variantId, data.marketId, data.currencyCode);
    const cart = await getOrCreateOwnerCart(tx, owner, data.marketId, data.currencyCode);
    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: data.variantId } }
    });
    const nextQuantity = (existing?.quantity ?? 0) + data.quantity;
    if (nextQuantity > 99) throw new Error("A maximum of 99 units may be added per product option.");
    if (nextQuantity > available) throw new Error("There is not enough available stock for this quantity.");
    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
    } else {
      await tx.cartItem.create({ data: { cartId: cart.id, variantId: data.variantId, quantity: data.quantity } });
    }
    return { cartId: cart.id, itemCount: await tx.cartItem.count({ where: { cartId: cart.id } }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Adds an entire previous order only if every line remains purchasable. */
export async function addCartItems(guestToken: string, input: unknown, now = new Date()) {
  const data = addManySchema.parse(input);
  const quantities = new Map<string, number>();
  for (const item of data.items) {
    const quantity = (quantities.get(item.variantId) ?? 0) + item.quantity;
    if (quantity > 99) throw new Error("A maximum of 99 units may be added per product option.");
    quantities.set(item.variantId, quantity);
  }

  return prisma.$transaction(async (tx) => {
    const owner = await resolveOwner(tx, guestToken, now);
    const cart = await getOrCreateOwnerCart(tx, owner, data.marketId, data.currencyCode);
    const existingItems = await tx.cartItem.findMany({
      where: { cartId: cart.id, variantId: { in: [...quantities.keys()] } },
      select: { id: true, variantId: true, quantity: true }
    });
    const existingByVariant = new Map(existingItems.map((item) => [item.variantId, item]));
    const validated = [];

    for (const [variantId, quantity] of quantities) {
      const { available } = await validatePurchasableVariant(tx, variantId, data.marketId, data.currencyCode);
      const existing = existingByVariant.get(variantId);
      if (quantity + (existing?.quantity ?? 0) > 99) {
        throw new Error("A maximum of 99 units may be added per product option.");
      }
      if (quantity + (existing?.quantity ?? 0) > available) {
        throw new Error("There is not enough available stock for every item in this reorder.");
      }
      validated.push({ variantId, quantity, existing });
    }

    for (const item of validated) {
      if (item.existing) {
        await tx.cartItem.update({
          where: { id: item.existing.id },
          data: { quantity: item.existing.quantity + item.quantity }
        });
      } else {
        await tx.cartItem.create({
          data: { cartId: cart.id, variantId: item.variantId, quantity: item.quantity }
        });
      }
    }
    return { cartId: cart.id, itemCount: await tx.cartItem.count({ where: { cartId: cart.id } }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Changes quantity only after checking current availability and cart ownership. */
export async function updateCartItemQuantity(
  guestToken: string,
  itemId: string,
  quantityInput: number,
  now = new Date()
) {
  const quantity = quantitySchema.parse(quantityInput);
  return prisma.$transaction(async (tx) => {
    const owner = await resolveOwner(tx, guestToken, now);
    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cart: { ...ownerFilter(owner), status: CartStatus.ACTIVE } },
      select: { id: true, variantId: true, cart: { select: { marketId: true, currencyCode: true } } }
    });
    if (!item) throw new Error("Cart item not found.");
    const { available } = await validatePurchasableVariant(tx, item.variantId, item.cart.marketId, item.cart.currencyCode);
    if (quantity > available) throw new Error("There is not enough available stock for this quantity.");
    return tx.cartItem.update({ where: { id: item.id }, data: { quantity }, select: { id: true, quantity: true } });
  });
}

/** Removes only an item belonging to the current guest or customer cart. */
export async function removeCartItem(guestToken: string, itemId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const owner = await resolveOwner(tx, guestToken, now);
    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cart: { ...ownerFilter(owner), status: CartStatus.ACTIVE } },
      select: { id: true }
    });
    if (!item) throw new Error("Cart item not found.");
    await tx.cartItem.delete({ where: { id: item.id } });
    return { removed: true };
  });
}
