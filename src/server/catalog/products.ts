import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
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
  const actor = await requirePermission({
    permissionKey: "catalog:manage",
    scope: { type: "STORE", id: data.storeId },
    now
  });

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
      select: { id: true, status: true, seller: { select: { status: true } }, markets: { where: { isEnabled: true }, select: { marketId: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") {
      throw new Error("An active seller store is required to manage products.");
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
