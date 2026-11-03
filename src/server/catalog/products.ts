import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasScopedPermission } from "@/server/identity/permission-repository";
import { requirePermission } from "@/server/identity/permission-guard";

const priceSchema = z.object({
  marketId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  amountMinor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/),
  compareAtMinor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/).optional()
}).refine((price) => price.compareAtMinor === undefined || BigInt(price.compareAtMinor) >= BigInt(price.amountMinor), {
  message: "Compare-at price must be greater than or equal to the selling price."
});

const createSchema = z.object({
  storeId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  description: z.string().trim().max(12000).optional(),
  brandId: z.string().trim().min(1).optional(),
  categoryIds: z.array(z.string().trim().min(1)).max(30).default([]),
  media: z.array(z.object({
    url: z.string().url().max(2048),
    altText: z.string().trim().max(300).optional(),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    isPrimary: z.boolean().default(false)
  })).max(30).default([]),
  variants: z.array(z.object({
    sku: z.string().trim().min(1).max(100),
    barcode: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().max(180).optional(),
    optionValues: z.record(z.string(), z.unknown()).optional(),
    prices: z.array(priceSchema).min(1).max(20)
  })).min(1).max(100)
}).strict();

export type CreateProductInput = z.input<typeof createSchema>;

/** Creates a draft product and its variants, media, categories and market prices atomically. */
export async function createDraftProduct(input: CreateProductInput, now = new Date()) {
  const data = createSchema.parse(input);
  const actor = await requireCurrentSession(now);

  const categoryIds = [...new Set(data.categoryIds)];
  const marketIds = [...new Set(data.variants.flatMap((variant) => variant.prices.map((price) => price.marketId)))];
  const currencyPairs = new Set<string>();
  for (const variant of data.variants) {
    const seen = new Set<string>();
    for (const price of variant.prices) {
      const key = price.marketId + ":" + price.currencyCode;
      if (seen.has(key)) throw new Error("A variant cannot contain duplicate prices for the same market and currency.");
      seen.add(key);
      currencyPairs.add(key);
    }
  }
  if (data.media.filter((item) => item.isPrimary).length > 1) throw new Error("Only one primary product image is allowed.");

  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, status: true, seller: { select: { status: true, ownerId: true } }, markets: { where: { isEnabled: true }, select: { marketId: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") {
      throw new Error("An active seller store is required to manage products.");
    }
    if (store.seller.ownerId !== actor.userId && !(await userHasScopedPermission(actor.userId, {
      permissionKey: "catalog:manage", scope: { type: "STORE", id: store.id }, now
    }))) {
      throw new Error("You do not have catalog access to this store.");
    }

    if (data.brandId) {
      const brand = await tx.brand.findFirst({ where: { id: data.brandId, status: CatalogEntityStatus.ACTIVE }, select: { id: true } });
      if (!brand) throw new Error("The selected brand is not active.");
    }
    if (categoryIds.length) {
      const count = await tx.category.count({ where: { id: { in: categoryIds }, status: CatalogEntityStatus.ACTIVE } });
      if (count !== categoryIds.length) throw new Error("Every selected category must be active.");
    }

    const allowedMarketIds = new Set(store.markets.map((market) => market.marketId));
    if (marketIds.some((id) => !allowedMarketIds.has(id))) throw new Error("Product prices may only target markets enabled for this store.");

    const markets = await tx.market.findMany({
      where: { id: { in: marketIds }, status: "ACTIVE", country: { isActive: true } },
      select: {
        id: true,
        currencies: { where: { isEnabled: true, currency: { isActive: true } }, select: { currencyCode: true } }
      }
    });
    if (markets.length !== marketIds.length) throw new Error("Every priced market must be active.");
    const enabledPairs = new Set(markets.flatMap((market) => market.currencies.map((currency) => market.id + ":" + currency.currencyCode)));
    for (const pair of currencyPairs) if (!enabledPairs.has(pair)) throw new Error("A product price uses a currency not enabled for its market.");

    const product = await tx.product.create({
      data: {
        storeId: store.id, brandId: data.brandId, name: data.name, slug: data.slug,
        description: data.description, status: CatalogEntityStatus.DRAFT,
        approvalStatus: ProductApprovalStatus.PENDING,
        categories: { create: categoryIds.map((categoryId, index) => ({ categoryId, isPrimary: index === 0, sortOrder: index })) },
        media: { create: data.media.map((item) => ({ ...item })) },
        variants: {
          create: data.variants.map((variant) => ({
            sku: variant.sku, barcode: variant.barcode, name: variant.name,
            optionValues: variant.optionValues as Prisma.InputJsonValue | undefined,
            prices: { create: variant.prices.map((price) => ({
              marketId: price.marketId, currencyCode: price.currencyCode,
              amountMinor: BigInt(price.amountMinor),
              compareAtMinor: price.compareAtMinor === undefined ? undefined : BigInt(price.compareAtMinor)
            })) }
          }))
        }
      },
      select: { id: true, storeId: true, name: true, slug: true, status: true, approvalStatus: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.created",
      resource: "product", resourceId: product.id, scopeType: "STORE", scopeId: store.id,
      occurredAt: now, metadata: { variantCount: data.variants.length, categoryCount: categoryIds.length, mediaCount: data.media.length }
    }});
    return product;
  });
}


/** Platform reviewer approves a pending product; approval is audited atomically. */
export async function approveProduct(productId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id }, select: { id: true, storeId: true, status: true, approvalStatus: true }
    });
    if (!product || product.approvalStatus !== ProductApprovalStatus.PENDING || product.status !== CatalogEntityStatus.DRAFT) {
      throw new Error("Only pending draft products can be approved.");
    }
    const changed = await tx.product.updateMany({
      where: { id, status: CatalogEntityStatus.DRAFT, approvalStatus: ProductApprovalStatus.PENDING },
      data: { approvalStatus: ProductApprovalStatus.APPROVED, approvedAt: now }
    });
    if (changed.count !== 1) throw new Error("Product has already been reviewed.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.approved",
      resource: "product", resourceId: id, scopeType: "STORE", scopeId: product.storeId, occurredAt: now
    }});
    return { productId: id, approvalStatus: ProductApprovalStatus.APPROVED };
  });
}

/** Publishes only approved products with a primary image and prices in every enabled active store market. */
export async function publishProduct(productId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const target = await prisma.product.findUnique({
    where: { id }, select: { storeId: true, store: { select: { seller: { select: { ownerId: true } } } } }
  });
  if (!target) throw new Error("Product was not found.");
  const actor = await requireCurrentSession(now);
  if (target.store.seller.ownerId !== actor.userId && !(await userHasScopedPermission(actor.userId, {
    permissionKey: "catalog:manage", scope: { type: "STORE", id: target.storeId }, now
  }))) {
    throw new Error("You do not have catalog access to this store.");
  }
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id },
      select: {
        id: true, storeId: true, status: true, approvalStatus: true,
        store: {
          select: {
            status: true, seller: { select: { status: true } },
            markets: { where: { isEnabled: true, market: { status: "ACTIVE" } }, select: { marketId: true, market: { select: { currencies: { where: { isEnabled: true, currency: { isActive: true } }, select: { currencyCode: true } } } } } }
          }
        },
        variants: { where: { isActive: true }, select: { id: true, prices: { select: { marketId: true, currencyCode: true } } } },
        media: { where: { type: "IMAGE", isPrimary: true }, select: { id: true }, take: 1 }
      }
    });
    if (!product || product.status !== CatalogEntityStatus.DRAFT || product.approvalStatus !== ProductApprovalStatus.APPROVED) {
      throw new Error("Only approved draft products can be published.");
    }
    if (product.store.status !== "ACTIVE" || product.store.seller.status !== "ACTIVE") throw new Error("An active seller store is required to publish products.");
    if (product.variants.length === 0 || product.media.length === 0) throw new Error("A product needs an active variant and a primary image before publishing.");
    const markets = product.store.markets;
    if (markets.length === 0) throw new Error("The store must have at least one active market.");
    for (const variant of product.variants) {
      for (const market of markets) {
        const allowed = new Set(market.market.currencies.map((currency) => currency.currencyCode));
        if (!variant.prices.some((price) => price.marketId === market.marketId && allowed.has(price.currencyCode))) {
          throw new Error("Every active variant needs a price in every active store market.");
        }
      }
    }
    const changed = await tx.product.updateMany({
      where: { id, status: CatalogEntityStatus.DRAFT, approvalStatus: ProductApprovalStatus.APPROVED },
      data: { status: CatalogEntityStatus.ACTIVE, publishedAt: now }
    });
    if (changed.count !== 1) throw new Error("Product could not be published.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.published",
      resource: "product", resourceId: id, scopeType: "STORE", scopeId: product.storeId, occurredAt: now
    }});
    return { productId: id, status: CatalogEntityStatus.ACTIVE, publishedAt: now };
  });
}
