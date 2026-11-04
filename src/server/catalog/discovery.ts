import "server-only";

import { CatalogEntityStatus, Prisma, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { tokenizeSearchQuery } from "@/server/search/query";
import { isSafeCatalogMediaUrl } from "@/server/catalog/media-url";

const querySchema = z.object({
  locale: z.string().trim().min(2).max(16).default("en"),
  q: z.string().trim().min(2).max(120).optional(),
  categoryId: z.string().trim().min(1).optional(),
  brandId: z.string().trim().min(1).optional(),
  storeId: z.string().trim().min(1).optional(),
  marketId: z.string().trim().min(1).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
  minPrice: z.string().trim().regex(/^(0|[1-9]\d{0,14})(\.\d{1,4})?$/).optional(),
  maxPrice: z.string().trim().regex(/^(0|[1-9]\d{0,14})(\.\d{1,4})?$/).optional(),
  inStock: z.enum(["true", "false"]).default("false"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  sort: z.enum(["relevance", "newest", "name_asc", "name_desc"]).optional()
}).strict().refine((value) => !value.currencyCode || !!value.marketId, {
  message: "A market is required when filtering by currency."
}).refine((value) => (!value.minPrice && !value.maxPrice) || (!!value.marketId && !!value.currencyCode), {
  message: "A market and currency are required when filtering by price."
}).refine((value) => !value.minPrice || !value.maxPrice || Number(value.minPrice) <= Number(value.maxPrice), {
  message: "Minimum price cannot exceed maximum price."
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
  return BigInt(whole) * (BigInt(10) ** BigInt(minorUnit)) +
    BigInt((fraction + "0".repeat(minorUnit)).slice(0, minorUnit) || "0");
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
  const hasPriceFilter = options.minPriceMinor !== undefined || options.maxPriceMinor !== undefined;
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
    ...(query.marketId && (query.currencyCode || hasPriceFilter) ? { prices: { some: priceWhere } } : {}),
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
    prisma.product.count({ where })
  ]);
  return {
    items: items.map((item) => ({
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
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}

export async function getDiscoverableProduct(slug: string, locale = "en") {
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
