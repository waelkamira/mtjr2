import "server-only";

import { CatalogEntityStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { tokenizeSearchQuery } from "@/server/search/query";

const querySchema = z.object({
  locale: z.string().trim().min(2).max(16).default("en"),
  q: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().trim().min(1).optional(),
  brandId: z.string().trim().min(1).optional(),
  storeId: z.string().trim().min(1).optional(),
  marketId: z.string().trim().min(1).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  sort: z.enum(["newest", "name_asc", "name_desc"]).default("newest")
}).strict().refine((value) => !value.currencyCode || !!value.marketId, {
  message: "A market is required when filtering by currency."
});

export type ProductDiscoveryInput = z.input<typeof querySchema>;
type ProductWithPrices = { variants: Array<{ prices: Array<{ amountMinor: bigint; compareAtMinor: bigint | null }> }> };

function serializeProductPrices<T extends ProductWithPrices>(product: T) {
  return {
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      prices: variant.prices.map((price) => ({
        ...price, amountMinor: price.amountMinor.toString(),
        compareAtMinor: price.compareAtMinor?.toString() ?? null
      }))
    }))
  };
}

function buildWhere(query: z.output<typeof querySchema>, searchGroups: Prisma.ProductWhereInput[][]): Prisma.ProductWhereInput {
  return {
    status: CatalogEntityStatus.ACTIVE,
    store: {
      ...(query.storeId ? { id: query.storeId } : {}),
      status: "ACTIVE", seller: { status: "ACTIVE" },
      ...(query.marketId ? { markets: { some: { marketId: query.marketId, isEnabled: true, market: { status: "ACTIVE" } } } } : {})
    },
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId, category: { status: CatalogEntityStatus.ACTIVE } } } } : {}),
    ...(searchGroups.length ? { AND: searchGroups.map((OR) => ({ OR })) } : {}),
    ...(query.marketId ? { variants: { some: {
      isActive: true,
      prices: { some: { marketId: query.marketId, market: { status: "ACTIVE", country: { isActive: true } }, currency: { isActive: true }, ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}) } }
    } } } : { variants: { some: { isActive: true } } })
  };
}

export async function listDiscoverableProducts(input: unknown = {}) {
  const query = querySchema.parse(input);
  const tokens = query.q ? tokenizeSearchQuery(query.q) : [];
  if (query.q && tokens.length === 0) {
    return { items: [], pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
  }
  const synonyms = tokens.length ? await prisma.searchSynonym.findMany({
    where: { locale: query.locale, isActive: true, OR: tokens.flatMap((token) => [
      { term: { equals: token, mode: "insensitive" as const } },
      { synonym: { equals: token, mode: "insensitive" as const } }
    ]) },
    select: { term: true, synonym: true }, take: 40
  }) : [];
  const searchGroups: Prisma.ProductWhereInput[][] = tokens.map((token) => {
    const terms = [...new Set([token, ...synonyms.filter((item) =>
      item.term.toLocaleLowerCase() === token || item.synonym.toLocaleLowerCase() === token
    ).flatMap((item) => [item.term, item.synonym])])].slice(0, 12);
    return terms.flatMap((term) => [
      { name: { contains: term, mode: "insensitive" as const } },
      { slug: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
      { translations: { some: { locale: query.locale, name: { contains: term, mode: "insensitive" as const } } } },
      { identifiers: { some: { value: { contains: term, mode: "insensitive" as const } } } },
      { variants: { some: { isActive: true, OR: [{ sku: { contains: term, mode: "insensitive" as const } }, { barcode: { contains: term, mode: "insensitive" as const } }] } } },
      { brand: { is: { name: { contains: term, mode: "insensitive" as const } } } },
      { store: { is: { name: { contains: term, mode: "insensitive" as const } } } },
      { categories: { some: { category: { status: CatalogEntityStatus.ACTIVE, name: { contains: term, mode: "insensitive" as const } } } } }
    ]);
  });
  const where = buildWhere(query, searchGroups);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    query.sort === "name_asc" ? [{ name: "asc" }, { id: "asc" }] :
    query.sort === "name_desc" ? [{ name: "desc" }, { id: "asc" }] :
    [{ publishedAt: "desc" }, { id: "asc" }];
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy, skip: (query.page - 1) * query.limit, take: query.limit,
      select: {
        id: true, slug: true, name: true, description: true, publishedAt: true,
        translations: { where: { locale: query.locale }, select: { name: true, description: true }, take: 1 },
        brand: { select: { id: true, name: true, slug: true } },
        store: { select: { id: true, name: true, slug: true } },
        media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 5, select: { url: true, altText: true, isPrimary: true } },
        categories: { where: { category: { status: CatalogEntityStatus.ACTIVE } }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 5, select: { category: { select: { id: true, name: true, slug: true } } } },
        variants: {
          where: { isActive: true }, take: 20, orderBy: { createdAt: "asc" },
          select: { id: true, sku: true, name: true, prices: {
            where: { market: { status: "ACTIVE", country: { isActive: true } }, currency: { isActive: true }, ...(query.marketId ? { marketId: query.marketId } : {}), ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}) },
            select: { marketId: true, currencyCode: true, amountMinor: true, compareAtMinor: true, currency: { select: { minorUnit: true } } }
          } }
        }
      }
    }),
    prisma.product.count({ where })
  ]);
  return {
    items: items.map((item) => ({
      ...serializeProductPrices(item),
      name: item.translations[0]?.name ?? item.name,
      description: item.translations[0]?.description ?? item.description
    })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}

export async function getDiscoverableProduct(slug: string, locale = "en") {
  const key = z.string().trim().min(1).max(180).parse(slug);
  const language = z.string().trim().min(2).max(16).parse(locale);
  const product = await prisma.product.findFirst({
    where: { slug: key, status: CatalogEntityStatus.ACTIVE, store: { status: "ACTIVE", seller: { status: "ACTIVE" } } },
    select: {
      id: true, slug: true, name: true, description: true, publishedAt: true,
      translations: { where: { locale: language }, select: { name: true, description: true }, take: 1 },
      brand: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, slug: true } },
      media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { url: true, altText: true, isPrimary: true } },
      categories: { where: { category: { status: CatalogEntityStatus.ACTIVE } }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { category: { select: { id: true, name: true, slug: true } } } },
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" }, select: {
        id: true, sku: true, name: true, optionValues: true,
        prices: { select: { marketId: true, currencyCode: true, amountMinor: true, compareAtMinor: true, currency: { select: { minorUnit: true } } } }
      } }
    }
  });
  if (!product) return null;
  return { ...serializeProductPrices(product), name: product.translations[0]?.name ?? product.name, description: product.translations[0]?.description ?? product.description };
}
