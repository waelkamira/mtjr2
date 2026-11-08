import "server-only";

import { CatalogEntityStatus, Prisma, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { defaultLocale } from "@/lib/locale";
import { tokenizeSearchQuery } from "@/server/search/query";
import { isSafeCatalogMediaUrl } from "@/server/catalog/media-url";

const optionalQueryString = (schema: z.ZodString) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  schema.optional()
);

const querySchema = z.object({
  locale: z.string().trim().min(2).max(16).default("ar"),
  q: optionalQueryString(z.string().trim().min(1).max(120)),
  categoryId: optionalQueryString(z.string().trim().min(1)),
  brandId: optionalQueryString(z.string().trim().min(1)),
  storeId: optionalQueryString(z.string().trim().min(1)),
  marketId: optionalQueryString(z.string().trim().min(1)),
  currencyCode: optionalQueryString(z.string().trim().length(3).toUpperCase()),
  minPrice: optionalQueryString(z.string().trim().regex(/^(0|[1-9]\d{0,14})(\.\d{1,4})?$/)),
  maxPrice: optionalQueryString(z.string().trim().regex(/^(0|[1-9]\d{0,14})(\.\d{1,4})?$/)),
  inStock: z.enum(["true", "false"]).default("false"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  sort: z.enum(["relevance", "newest", "name_asc", "name_desc"]).optional()
}).strict().refine((value) => !value.currencyCode || !!value.marketId, {
  message: "A market is required when filtering by currency."
}).refine((value) => (!value.minPrice && !value.maxPrice) || (!!value.marketId && !!value.currencyCode), {
  message: "A market and currency are required when filtering by price."
}).refine((value) => value.sort !== "relevance" || !!value.q, {
  message: "Relevance sorting requires a search query."
});

export type ProductDiscoveryInput = z.input<typeof querySchema>;
type ParsedQuery = z.output<typeof querySchema> & { sort: "relevance" | "newest" | "name_asc" | "name_desc" };

function priceToMinor(value: string, minorUnit: number): bigint {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > minorUnit) throw new z.ZodError([{
    code: "custom",
    path: ["price"],
    message: `Price supports at most ${minorUnit} decimal places for the selected currency.`
  }]);
  const amount = BigInt(whole) * (BigInt(10) ** BigInt(minorUnit)) +
    BigInt((fraction + "0".repeat(minorUnit)).slice(0, minorUnit) || "0");
  if (amount > BigInt("9223372036854775807")) {
    throw new z.ZodError([{ code: "custom", path: ["price"], message: "Price exceeds the supported range." }]);
  }
  return amount;
}
type ProductWithPrices = {
  store?: {
    id: string;
    name: string;
    slug: string;
    markets?: Array<{ marketId: string }>;
  };
  variants: Array<{
    prices: Array<{
      amountMinor: bigint;
      compareAtMinor: bigint | null;
      marketId?: string;
      currencyCode?: string;
      market?: {
        status: string;
        country: { isActive: boolean };
        currencies: Array<{ currencyCode: string }>;
      };
    }>;
  }>;
};

function serializeProductPrices<T extends ProductWithPrices>(product: T) {
  const enabledMarketIds = product.store?.markets
    ? new Set(product.store.markets.map((market) => market.marketId))
    : null;
  return {
    ...product,
    ...(product.store ? {
      store: { id: product.store.id, name: product.store.name, slug: product.store.slug }
    } : {}),
    variants: product.variants.map((variant) => ({
      ...variant,
      prices: variant.prices.filter((price) =>
        (!enabledMarketIds || enabledMarketIds.has(price.marketId ?? "")) &&
        (!price.market || (
          price.market.status === "ACTIVE" &&
          price.market.country.isActive &&
          price.market.currencies.some((currency) => currency.currencyCode === price.currencyCode)
        ))
      ).map((price) => {
        const serializedPrice = {
          ...price,
          amountMinor: price.amountMinor.toString(),
          compareAtMinor: price.compareAtMinor?.toString() ?? null
        };
        delete serializedPrice.market;
        return serializedPrice;
      })
    }))
  };
}

function buildWhere(
  query: ParsedQuery,
  searchGroups: Prisma.ProductWhereInput[][],
  options: { omitCategory?: boolean; omitBrand?: boolean; stockVariantIds?: string[]; minPriceMinor?: bigint; maxPriceMinor?: bigint } = {}
): Prisma.ProductWhereInput {
  const priceWhere: Prisma.ProductPriceWhereInput = {
    marketId: query.marketId,
    currencyCode: query.currencyCode,
    market: {
      status: "ACTIVE",
      country: { isActive: true },
      currencies: { some: { isEnabled: true, currency: { isActive: true }, currencyCode: query.currencyCode } }
    },
    currency: { isActive: true },
    ...(options.minPriceMinor !== undefined || options.maxPriceMinor !== undefined ? {
      amountMinor: {
        ...(options.minPriceMinor !== undefined ? { gte: options.minPriceMinor } : {}),
        ...(options.maxPriceMinor !== undefined ? { lte: options.maxPriceMinor } : {})
      }
    } : {})
  };
  const variantFilter: Prisma.ProductVariantWhereInput = {
    isActive: true,
    ...(query.marketId ? { prices: { some: priceWhere } } : {}),
    ...(query.inStock === "true" ? { id: { in: options.stockVariantIds ?? [] } } : {})
  };
  return {
    status: CatalogEntityStatus.ACTIVE,
    approvalStatus: ProductApprovalStatus.APPROVED,
    store: {
      ...(query.storeId ? { id: query.storeId } : {}),
      status: "ACTIVE", seller: { status: "ACTIVE" },
      ...(query.marketId ? { markets: { some: { marketId: query.marketId, isEnabled: true, market: { status: "ACTIVE" } } } } : {})
    },
    ...(!options.omitBrand && query.brandId ? { brand: { is: { id: query.brandId, status: CatalogEntityStatus.ACTIVE } } } : {}),
    ...(!options.omitCategory && query.categoryId ? { categories: { some: { categoryId: query.categoryId, category: { status: CatalogEntityStatus.ACTIVE } } } } : {}),
    ...(searchGroups.length ? { AND: searchGroups.map((OR) => ({ OR })) } : {}),
    variants: { some: variantFilter }
  };
}

function priceFilterToSql(
  minPriceMinor?: bigint,
  maxPriceMinor?: bigint,
  marketId?: string,
  currencyCode?: string
) {
  if (minPriceMinor === undefined && maxPriceMinor === undefined) return Prisma.empty;
  return Prisma.sql`AND EXISTS (
    SELECT 1
    FROM "ProductVariant" pv
    JOIN "ProductPrice" pp ON pp."variantId" = pv.id
    JOIN "Market" m ON m.id = pp."marketId"
    JOIN "Country" country ON country.id = m."countryId"
    JOIN "MarketCurrency" mc ON mc."marketId" = m.id AND mc."currencyCode" = pp."currencyCode"
    JOIN "Currency" currency ON currency.code = pp."currencyCode"
    WHERE pv."productId" = p.id AND pv."isActive" = true
      AND pp."marketId" = ${marketId}
      AND pp."currencyCode" = ${currencyCode}
      AND m.status = 'ACTIVE' AND country."isActive" = true
      AND mc."isEnabled" = true AND currency."isActive" = true
      ${minPriceMinor === undefined ? Prisma.empty : Prisma.sql`AND pp."amountMinor" >= ${minPriceMinor}`}
      ${maxPriceMinor === undefined ? Prisma.empty : Prisma.sql`AND pp."amountMinor" <= ${maxPriceMinor}`}
  )`;
}

async function findInStockVariantIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT DISTINCT inventory."variantId" AS id
    FROM "Inventory" inventory
    JOIN "Warehouse" warehouse ON warehouse.id = inventory."warehouseId"
    WHERE warehouse."isActive" = true
      AND inventory."quantityOnHand" > inventory."quantityReserved"
  `);
  return rows.map(({ id }) => id);
}

function relevanceSql(
  query: ParsedQuery,
  tokenTerms: string[][],
  minPriceMinor?: bigint,
  maxPriceMinor?: bigint
) {
  const tokenConditions = tokenTerms.map((terms) => Prisma.sql`(
    ${Prisma.join(terms.map((term) => {
      const pattern = `%${term}%`;
      return Prisma.sql`(
        searchable."searchText" ILIKE ${pattern}
        OR p.name % ${term}
        OR p.slug % ${term}
        OR coalesce(p.description, '') % ${term}
        OR coalesce(b.name, '') % ${term}
        OR s.name % ${term}
        OR EXISTS (
          SELECT 1 FROM "ProductTranslation" pt
          WHERE pt."productId" = p.id AND pt.locale = ${query.locale}
            AND (pt.name ILIKE ${pattern} OR pt.name % ${term})
        )
        OR EXISTS (
          SELECT 1 FROM "ProductIdentifier" identifier
          WHERE identifier."productId" = p.id
            AND (identifier.value ILIKE ${pattern} OR identifier.value % ${term})
        )
        OR EXISTS (
          SELECT 1 FROM "ProductVariant" search_variant
          WHERE search_variant."productId" = p.id AND search_variant."isActive" = true
            AND (search_variant.sku ILIKE ${pattern} OR search_variant.sku % ${term}
              OR coalesce(search_variant.barcode, '') ILIKE ${pattern}
              OR coalesce(search_variant.barcode, '') % ${term})
        )
      )`;
    }), " OR ")}
  )`);
  const filters = [
    query.storeId ? Prisma.sql`AND s.id = ${query.storeId}` : Prisma.empty,
    query.brandId ? Prisma.sql`AND p."brandId" = ${query.brandId} AND b.status = 'ACTIVE'` : Prisma.empty,
    query.categoryId ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM "ProductCategory" pc
      JOIN "Category" category ON category.id = pc."categoryId"
      WHERE pc."productId" = p.id AND category.status = 'ACTIVE' AND category.id = ${query.categoryId}
    )` : Prisma.empty,
    query.marketId ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM "StoreMarket" sm
      JOIN "Market" market ON market.id = sm."marketId"
      JOIN "Country" country ON country.id = market."countryId"
      WHERE sm."storeId" = s.id AND sm."marketId" = ${query.marketId}
        AND sm."isEnabled" = true AND market.status = 'ACTIVE' AND country."isActive" = true
    )` : Prisma.empty,
    query.marketId ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM "ProductVariant" priced_variant
      JOIN "ProductPrice" pp ON pp."variantId" = priced_variant.id
      JOIN "Market" market ON market.id = pp."marketId"
      JOIN "Country" country ON country.id = market."countryId"
      JOIN "MarketCurrency" mc ON mc."marketId" = market.id AND mc."currencyCode" = pp."currencyCode"
      JOIN "Currency" currency ON currency.code = pp."currencyCode"
      WHERE priced_variant."productId" = p.id AND priced_variant."isActive" = true
        AND pp."marketId" = ${query.marketId}
        ${query.currencyCode ? Prisma.sql`AND pp."currencyCode" = ${query.currencyCode}` : Prisma.empty}
        AND market.status = 'ACTIVE' AND country."isActive" = true
        AND mc."isEnabled" = true AND currency."isActive" = true
    )` : Prisma.empty,
    priceFilterToSql(minPriceMinor, maxPriceMinor, query.marketId, query.currencyCode),
    query.inStock === "true" ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM "ProductVariant" stock_variant
      JOIN "Inventory" inventory ON inventory."variantId" = stock_variant.id
      JOIN "Warehouse" warehouse ON warehouse.id = inventory."warehouseId"
      WHERE stock_variant."productId" = p.id AND stock_variant."isActive" = true
        AND warehouse."isActive" = true
        AND inventory."quantityOnHand" > inventory."quantityReserved"
    )` : Prisma.empty
  ];
  return Prisma.sql`
    WITH searchable AS (
      SELECT p.id,
        concat_ws(' ', p.name, p.slug, p.description, b.name, s.name, seller."displayName",
          (SELECT string_agg(pt.name, ' ') FROM "ProductTranslation" pt WHERE pt."productId" = p.id AND pt.locale = ${query.locale}),
          (SELECT string_agg(concat_ws(' ', category.name, category_translation.name), ' ')
            FROM "ProductCategory" pc JOIN "Category" category ON category.id = pc."categoryId"
            LEFT JOIN "CategoryTranslation" category_translation ON category_translation."categoryId" = category.id AND category_translation.locale = ${query.locale}
            WHERE pc."productId" = p.id AND category.status = 'ACTIVE'),
          (SELECT string_agg(concat_ws(' ', search_variant.sku, search_variant.barcode), ' ')
            FROM "ProductVariant" search_variant WHERE search_variant."productId" = p.id AND search_variant."isActive" = true),
          (SELECT string_agg(identifier.value, ' ') FROM "ProductIdentifier" identifier WHERE identifier."productId" = p.id)
        ) AS "searchText"
      FROM "Product" p
      JOIN "Store" s ON s.id = p."storeId"
      JOIN "Seller" seller ON seller.id = s."sellerId"
      LEFT JOIN "Brand" b ON b.id = p."brandId"
      WHERE p.status = 'ACTIVE' AND p."approvalStatus" = 'APPROVED'
        AND s.status = 'ACTIVE' AND seller.status = 'ACTIVE'
        ${Prisma.join(filters, " ")}
    ), matching AS (
      SELECT p.id, p."publishedAt",
        GREATEST(
          CASE WHEN p.name ILIKE ${`%${query.q}%`} THEN 1.0 ELSE similarity(p.name, ${query.q}) END,
          similarity(p.slug, ${query.q}),
          similarity(coalesce(b.name, ''), ${query.q}),
          similarity(s.name, ${query.q}),
          similarity(searchable."searchText", ${query.q})
        ) AS score
      FROM "Product" p
      JOIN "Store" s ON s.id = p."storeId"
      JOIN "Seller" seller ON seller.id = s."sellerId"
      LEFT JOIN "Brand" b ON b.id = p."brandId"
      JOIN searchable ON searchable.id = p.id
      WHERE ${Prisma.join(tokenConditions, " AND ")}
    )
    SELECT id, score, "publishedAt", count(*) OVER() AS total
    FROM matching
    ORDER BY score DESC, "publishedAt" DESC, id ASC
  `;
}

export async function listDiscoverableProducts(input: unknown = {}, options: { includeFacets?: boolean } = {}) {
  const parsed = querySchema.parse(input);
  const query: ParsedQuery = { ...parsed, sort: parsed.sort ?? (parsed.q ? "relevance" : "newest") };
  const tokens = query.q ? tokenizeSearchQuery(query.q) : [];
  if (query.q && tokens.length === 0) {
    return {
      items: [],
      pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      facets: { categories: [], brands: [], inStockCount: 0 }
    };
  }
  const currency = query.currencyCode
    ? await prisma.currency.findFirst({
        where: {
          code: query.currencyCode,
          isActive: true,
          marketLinks: { some: { marketId: query.marketId, isEnabled: true, market: { status: "ACTIVE", country: { isActive: true } } } }
        },
        select: { minorUnit: true }
      })
    : null;
  if (query.currencyCode && !currency) {
    throw new z.ZodError([{ code: "custom", path: ["currencyCode"], message: "Select an active currency enabled in the selected market." }]);
  }
  const minPriceMinor = query.minPrice && currency ? priceToMinor(query.minPrice, currency.minorUnit) : undefined;
  const maxPriceMinor = query.maxPrice && currency ? priceToMinor(query.maxPrice, currency.minorUnit) : undefined;
  if (minPriceMinor !== undefined && maxPriceMinor !== undefined && minPriceMinor > maxPriceMinor) {
    throw new z.ZodError([{ code: "custom", path: ["minPrice"], message: "Minimum price cannot exceed maximum price." }]);
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
      { brand: { is: { status: CatalogEntityStatus.ACTIVE, OR: [
        { name: { contains: term, mode: "insensitive" as const } },
        { translations: { some: { locale: query.locale, name: { contains: term, mode: "insensitive" as const } } } }
      ] } } },
      { store: { is: { name: { contains: term, mode: "insensitive" as const } } } },
      { store: { is: { seller: { is: { displayName: { contains: term, mode: "insensitive" as const } } } } } },

      { categories: { some: { category: { status: CatalogEntityStatus.ACTIVE, OR: [
        { name: { contains: term, mode: "insensitive" as const } },
        { translations: { some: { locale: query.locale, name: { contains: term, mode: "insensitive" as const } } } }
      ] } } } }
    ]);
  });
  const tokenTerms = tokens.map((token) => [...new Set([token, ...synonyms.filter((item) =>
    item.term.toLocaleLowerCase() === token || item.synonym.toLocaleLowerCase() === token
  ).flatMap((item) => [item.term, item.synonym])])].slice(0, 12));
  const availableVariantIds = query.inStock === "true" || options.includeFacets !== false
    ? await findInStockVariantIds()
    : [];
  const stockVariantIds = query.inStock === "true" ? availableVariantIds : undefined;
  const where = buildWhere(query, searchGroups, { stockVariantIds, minPriceMinor, maxPriceMinor });
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    query.sort === "name_asc" ? [{ name: "asc" }, { id: "asc" }] :
    query.sort === "name_desc" ? [{ name: "desc" }, { id: "asc" }] :
    [{ publishedAt: "desc" }, { id: "asc" }];
  const useRelevance = Boolean(query.q && query.sort === "relevance");
  const rankedRows = useRelevance
    ? await prisma.$queryRaw<Array<{ id: string; total: bigint | number }>>(Prisma.sql`
        ${relevanceSql(query, tokenTerms, minPriceMinor, maxPriceMinor)}
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
      `)
    : null;
  const resultWhere = useRelevance
    ? { AND: [buildWhere(query, [], { stockVariantIds, minPriceMinor, maxPriceMinor }), { id: { in: rankedRows?.map((row) => row.id) ?? [] } }] }
    : where;
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where: resultWhere, orderBy: useRelevance ? { id: "asc" } : orderBy,
      ...(useRelevance ? {} : { skip: (query.page - 1) * query.limit, take: query.limit }),
      select: {
        id: true, slug: true, name: true, description: true, publishedAt: true,
      city: true, district: true, contactPhone: true, videoUrl: true,
      mapLocation: { select: { publicLatitude: true, publicLongitude: true } },
      propertyDetails: { select: { propertyType: true, listingType: true, bedrooms: true, bathrooms: true, floorArea: true } },
        translations: { where: { locale: query.locale }, select: { name: true, description: true, seoTitle: true, seoDescription: true }, take: 1 },
        brand: {
          select: {
            id: true, name: true, slug: true, status: true,
            translations: { where: { locale: query.locale }, select: { name: true }, take: 1 }
          }
        },
        store: {
          select: {
            id: true, name: true, slug: true,
            markets: {
              where: { isEnabled: true, market: { status: "ACTIVE", country: { isActive: true } } },
              select: { marketId: true }
            }
          }
        },
        media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 5, select: { url: true, altText: true, isPrimary: true } },
        categories: {
          where: { category: { status: CatalogEntityStatus.ACTIVE } },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 5,
          select: {
            category: {
              select: {
                id: true, name: true, slug: true,
                translations: { where: { locale: query.locale }, select: { name: true }, take: 1 }
              }
            }
          }
        },
        variants: {
          where: { isActive: true }, take: 20, orderBy: { createdAt: "asc" },
          select: { id: true, sku: true, name: true, prices: {
            where: {
              market: {
                status: "ACTIVE",
                country: { isActive: true },
                ...(query.marketId ? { id: query.marketId } : {}),
                currencies: {
                  some: {
                    isEnabled: true,
                    currency: { isActive: true },
                    ...(query.currencyCode ? { currencyCode: query.currencyCode } : {})
                  }
                }
              },
              currency: { isActive: true },
              ...(query.marketId ? { marketId: query.marketId } : {}),
              ...(query.currencyCode ? { currencyCode: query.currencyCode } : {})
            },
            select: {
              marketId: true, currencyCode: true, amountMinor: true, compareAtMinor: true,
              currency: { select: { minorUnit: true } },
              market: {
                select: {
                  status: true,
                  country: { select: { isActive: true } },
                  currencies: {
                    where: { isEnabled: true, currency: { isActive: true } },
                    select: { currencyCode: true }
                  }
                }
              }
            }
          } }
        }
      }
    }),
    useRelevance
      ? rankedRows?.length
        ? Promise.resolve(Number(rankedRows[0].total))
        : prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
            SELECT count(*) AS total FROM (${relevanceSql(query, tokenTerms, minPriceMinor, maxPriceMinor)}) ranked
          `).then((rows) => Number(rows[0]?.total ?? 0))
      : prisma.product.count({ where })
  ]);
  const orderedItems = useRelevance
    ? rankedRows?.flatMap((row) => {
        const item = items.find((candidate) => candidate.id === row.id);
        return item ? [item] : [];
      }) ?? []
    : items;
  const [brandFacets, categoryFacets, inStockCount] = options.includeFacets === false
    ? [[], [], 0]
    : await Promise.all([
        prisma.product.groupBy({
          by: ["brandId"],
          where: buildWhere(query, searchGroups, { omitBrand: true, stockVariantIds, minPriceMinor, maxPriceMinor }),
          _count: { _all: true }
        }),
        prisma.productCategory.groupBy({
          by: ["categoryId"],
          where: {
            product: buildWhere(query, searchGroups, { omitCategory: true, stockVariantIds, minPriceMinor, maxPriceMinor }),
            category: { status: CatalogEntityStatus.ACTIVE }
          },
          _count: { _all: true }
        }),
        prisma.product.count({
          where: {
            AND: [
              buildWhere({ ...query, inStock: "true" }, searchGroups, { stockVariantIds: availableVariantIds, minPriceMinor, maxPriceMinor })
            ]
          }
        })
      ]);
  return {
    items: orderedItems.map((item) => ({
      ...serializeProductPrices({
        ...item,
        brand: item.brand?.status === CatalogEntityStatus.ACTIVE
          ? {
              id: item.brand.id,
              name: item.brand.translations[0]?.name ?? item.brand.name,
              slug: item.brand.slug
            }
          : null,
        categories: item.categories.map(({ category }) => ({
          id: category.id,
          name: category.translations[0]?.name ?? category.name,
          slug: category.slug
        })),
        media: item.media.filter((media) => isSafeCatalogMediaUrl(media.url))
      }),
      name: item.translations[0]?.name ?? item.name,
      description: item.translations[0]?.description ?? item.description,
      seoTitle: item.translations[0]?.seoTitle ?? item.translations[0]?.name ?? item.name,
      seoDescription: item.translations[0]?.seoDescription ?? item.translations[0]?.description ?? item.description
    })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    facets: {
      categories: categoryFacets.map((facet) => ({ id: facet.categoryId, count: facet._count._all })),
      brands: brandFacets.filter((facet) => facet.brandId !== null).map((facet) => ({ id: facet.brandId!, count: facet._count._all })),
      inStockCount
    }
  };
}

export async function getDiscoverableProduct(slug: string, locale = defaultLocale) {
  const key = z.string().trim().min(1).max(180).parse(slug);
  const language = z.string().trim().min(2).max(16).parse(locale);
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ slug: key }, { id: key }],
      status: CatalogEntityStatus.ACTIVE,
      approvalStatus: ProductApprovalStatus.APPROVED,
      store: { status: "ACTIVE", seller: { status: "ACTIVE" } }
    },
    select: {
      id: true, slug: true, name: true, description: true, publishedAt: true,
      translations: { where: { locale: language }, select: { name: true, description: true, seoTitle: true, seoDescription: true }, take: 1 },
      brand: {
        select: {
          id: true, name: true, slug: true, status: true,
          translations: { where: { locale: language }, select: { name: true }, take: 1 }
        }
      },
      store: {
        select: {
          id: true, name: true, slug: true,
          markets: {
            where: { isEnabled: true, market: { status: "ACTIVE", country: { isActive: true } } },
            select: { marketId: true }
          }
        }
      },
      media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { url: true, altText: true, isPrimary: true } },
      categories: {
        where: { category: { status: CatalogEntityStatus.ACTIVE } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          category: {
            select: {
              id: true, name: true, slug: true,
              translations: { where: { locale: language }, select: { name: true }, take: 1 }
            }
          }
        }
      },
      attributes: {
        select: {
          attribute: {
            select: {
              key: true, valueType: true,
              translations: { where: { locale: language }, select: { name: true }, take: 1 }
            }
          },
          values: { orderBy: { sortOrder: "asc" }, select: { value: true } }
        }
      },
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" }, select: {
        id: true, sku: true, name: true, optionValues: true,
        attributes: {
          select: {
            value: true,
            attribute: {
              select: {
                key: true, valueType: true,
                translations: { where: { locale: language }, select: { name: true }, take: 1 }
              }
            }
          }
        },
        prices: {
          where: {
            market: {
              status: "ACTIVE",
              country: { isActive: true },
              currencies: { some: { isEnabled: true, currency: { isActive: true } } }
            },
            currency: { isActive: true }
          },
          select: {
            marketId: true, currencyCode: true, amountMinor: true, compareAtMinor: true,
            currency: { select: { minorUnit: true } },
            market: {
              select: {
                status: true,
                country: { select: { isActive: true } },
                currencies: {
                  where: { isEnabled: true, currency: { isActive: true } },
                  select: { currencyCode: true }
                }
              }
            }
          }
        }
      } }
    }
  });
  if (!product) return null;
  const { translations, attributes, ...productData } = product;
  const localized = serializeProductPrices({
    ...productData,
    brand: product.brand?.status === CatalogEntityStatus.ACTIVE
      ? {
          id: product.brand.id,
          name: product.brand.translations[0]?.name ?? product.brand.name,
          slug: product.brand.slug
        }
      : null,
    media: product.media.filter((media) => isSafeCatalogMediaUrl(media.url)),
    categories: product.categories.map(({ category }) => ({
      id: category.id,
      slug: category.slug,
      name: category.translations[0]?.name ?? category.name
    })),
    attributes: attributes.map(({ attribute, values }) => ({
      key: attribute.key,
      name: attribute.translations[0]?.name ?? attribute.key,
      valueType: attribute.valueType,
      values: values.map(({ value }) => value)
    })),
    variants: product.variants.map((variant) => ({
      ...variant,
      attributes: variant.attributes.map(({ attribute, value }) => ({
        key: attribute.key,
        name: attribute.translations[0]?.name ?? attribute.key,
        valueType: attribute.valueType,
        value
      }))
    }))
  });
  return {
    ...localized,
    name: translations[0]?.name ?? product.name,
    description: translations[0]?.description ?? product.description,
    seoTitle: translations[0]?.seoTitle ?? translations[0]?.name ?? product.name,
    seoDescription: translations[0]?.seoDescription ?? translations[0]?.description ?? product.description
  };
}
