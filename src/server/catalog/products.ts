import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession, PermissionDeniedError } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { requirePermission } from "@/server/identity/permission-guard";
import { isSafeCatalogMediaUrl } from "@/server/catalog/media-url";
import { deleteProductImage } from "@/server/media/product-image-deletion";

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
  specifications: z.object({
    model: z.string().trim().max(160).optional(),
    color: z.string().trim().max(160).optional(),
    material: z.string().trim().max(160).optional(),
    weight: z.string().trim().max(160).optional(),
    dimensions: z.string().trim().max(160).optional(),
    condition: z.string().trim().max(160).optional(),
    warranty: z.string().trim().max(160).optional(),
    countryOfOrigin: z.string().trim().max(160).optional(),
    custom: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      value: z.string().trim().min(1).max(240)
    }).strict()).max(50).default([])
  }).strict().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  district: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().min(6).max(40).optional(),
  videoUrl: z.string().url().max(2048).refine((value) => value.startsWith("https://"), "Video links must use HTTPS.").optional(),
  propertyDetails: z.object({
    propertyType: z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL"]),
    listingType: z.enum(["SALE", "RENT"]),
    bedrooms: z.number().int().min(0).max(100).nullable().optional(),
    bathrooms: z.number().int().min(0).max(100).nullable().optional(),
    floorArea: z.string().regex(/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/)
      .refine((value) => Number(value) > 0, "Floor area must be greater than zero.")
  }).optional(),
  brandId: z.string().trim().min(1).optional(),
  categoryIds: z.array(z.string().trim().min(1)).max(30).default([]),
  attributes: z.array(z.object({
    attributeDefinitionId: z.string().trim().min(1),
    value: z.unknown()
  }).strict()).max(100).default([]),
  localityId: z.string().trim().min(1).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  streetAddress: z.string().trim().max(500).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  media: z.array(z.object({
    url: z.string().url().max(2048).refine(isSafeCatalogMediaUrl, "Product media URLs must use HTTPS and cannot include credentials."),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]).optional(),
    storageKey: z.string().trim().max(1024).optional(),
    width: z.number().int().positive().max(100000).optional(),
    height: z.number().int().positive().max(100000).optional(),
    altText: z.string().trim().max(300).optional(),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    isPrimary: z.boolean().default(false)
  })).max(30).default([]),
  variants: z.array(z.object({
    sku: z.string().trim().min(1).max(100),
    barcode: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().max(180).optional(),
    weightGrams: z.number().int().min(0).max(1000000).optional(),
    optionValues: z.record(z.string(), z.unknown()).optional(),
    prices: z.array(priceSchema).min(1).max(20)
  })).min(1).max(100)
}).strict();

export type CreateProductInput = z.input<typeof createSchema>;

async function hasCategoryAncestorSlug(
  tx: Prisma.TransactionClient,
  categories: Array<{ parentId: string | null; slug: string }>,
  targetSlug: string
) {
  if (categories.some((category) => category.slug === targetSlug)) return true;
  let parentIds = [...new Set(categories.map((category) => category.parentId).filter((id): id is string => Boolean(id)))];
  const visited = new Set<string>();
  for (let depth = 0; parentIds.length && depth < 12; depth += 1) {
    parentIds = parentIds.filter((id) => !visited.has(id));
    if (!parentIds.length) break;
    parentIds.forEach((id) => visited.add(id));
    const parents = await tx.category.findMany({
      where: { id: { in: parentIds }, status: CatalogEntityStatus.ACTIVE },
      select: { id: true, parentId: true, slug: true }
    });
    if (parents.some((category) => category.slug === targetSlug)) return true;
    parentIds = parents.map((category) => category.parentId).filter((id): id is string => Boolean(id));
  }
  return false;
}

async function canManageStoreCatalog(userId: string, ownerId: string, storeId: string, now: Date) {
  if (ownerId === userId) return true;
  const [scopedManager, platformAdmin] = await Promise.all([
    userHasScopedPermission(userId, { permissionKey: "catalog:manage", scope: { type: "STORE", id: storeId }, now }),
    userHasPermission(userId, { permissionKey: "users:manage", now })
  ]);
  return scopedManager || platformAdmin;
}

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
      select: { id: true, status: true, seller: { select: { status: true, ownerId: true } }, markets: { where: { isEnabled: true, market: { status: "ACTIVE", country: { isActive: true } } }, select: { marketId: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") {
      throw new Error("An active seller store is required to manage products.");
    }
    if (!(await canManageStoreCatalog(actor.userId, store.seller.ownerId, store.id, now))) {
      throw new PermissionDeniedError("You do not have catalog access to this store.");
    }

    if (data.brandId) {
      const brand = await tx.brand.findFirst({ where: { id: data.brandId, status: CatalogEntityStatus.ACTIVE }, select: { id: true } });
      if (!brand) throw new Error("The selected brand is not active.");
    }
    const selectedCategories = categoryIds.length
      ? await tx.category.findMany({ where: { id: { in: categoryIds }, status: CatalogEntityStatus.ACTIVE }, select: { id: true, slug: true, parentId: true } })
      : [];
    if (selectedCategories.length !== categoryIds.length) throw new Error("Every selected category must be active.");
    const isRealEstate = await hasCategoryAncestorSlug(tx, selectedCategories, "real-estate");
    if (isRealEstate && (!data.propertyDetails || data.latitude === undefined || data.longitude === undefined)) {
      throw new Error("Real-estate listings require property details and map coordinates.");
    }
    if (!isRealEstate && data.propertyDetails) {
      throw new Error("Property details can only be added to a real-estate listing.");
    }

    if ((data.latitude === undefined) !== (data.longitude === undefined)) {
      throw new Error("Latitude and longitude must be supplied together.");
    }
    const selectedLocality = data.localityId
      ? await tx.syriaLocality.findUnique({ where: { id: data.localityId }, select: { id: true, governorateId: true } })
      : null;
    if (data.localityId && !selectedLocality) throw new Error("The selected Syrian locality is unavailable.");
    const categoryAttributeRows = categoryIds.length
      ? await tx.categoryAttribute.findMany({
          where: { categoryId: { in: categoryIds } },
          select: { attributeDefinitionId: true, isRequired: true, isVariantLevel: true, options: true, attribute: { select: { key: true, valueType: true } } }
        })
      : [];
    const allowedAttributes = new Map(categoryAttributeRows.map((row) => [row.attributeDefinitionId, row]));
    const productAttributesByKey = new Map(categoryAttributeRows.filter((row) => !row.isVariantLevel).map((row) => [row.attribute.key, row]));
    const variantAttributesByKey = new Map(categoryAttributeRows.filter((row) => row.isVariantLevel).map((row) => [row.attribute.key, row]));
    const submittedAttributes = new Map(data.attributes.map((item) => [item.attributeDefinitionId, item.value]));
    if (submittedAttributes.size !== data.attributes.length) throw new Error("A product attribute was submitted more than once.");
    const validateAttributeValue = (definition: (typeof categoryAttributeRows)[number], value: unknown) => {
      const options = Array.isArray(definition.options) ? definition.options : [];
      if (definition.attribute.valueType === "TEXT" && (typeof value !== "string" || value.length > 2000)) throw new Error("A text attribute must contain at most 2,000 characters.");
      if (definition.attribute.valueType === "NUMBER" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("A numeric attribute must contain a valid number.");
      if (definition.attribute.valueType === "BOOLEAN" && typeof value !== "boolean") throw new Error("A boolean attribute must contain true or false.");
      if (definition.attribute.valueType === "SELECT" && (typeof value !== "string" || !options.includes(value))) throw new Error("A selected attribute value is invalid.");
      if (definition.attribute.valueType === "MULTI_SELECT" && (!Array.isArray(value) || value.length > 100 || value.some((entry) => typeof entry !== "string" || !options.includes(entry)) || new Set(value).size !== value.length)) throw new Error("A multi-select attribute value is invalid.");
    };
    const hasAttributeValue = (value: unknown) => value !== undefined && value !== null && value !== "" &&
      !(typeof value === "string" && !value.trim()) && !(Array.isArray(value) && value.length === 0);
    for (const [attributeId, value] of submittedAttributes) {
      const definition = allowedAttributes.get(attributeId);
      if (!definition || definition.isVariantLevel) throw new Error("A submitted product attribute does not belong to the selected category or is variant-level.");
      validateAttributeValue(definition, value);
    }
    for (const variant of data.variants) {
      for (const [key, value] of Object.entries(variant.optionValues ?? {})) {
        const definition = variantAttributesByKey.get(key);
        if (!definition) throw new Error("A submitted variant option does not belong to the selected category.");
        validateAttributeValue(definition, value);
      }
    }
    for (const row of categoryAttributeRows) {
      if (!row.isRequired) continue;
      if (row.isVariantLevel) {
        for (const variant of data.variants) {
          if (!hasAttributeValue(variant.optionValues?.[row.attribute.key])) {
            throw new Error("Please complete all required variant options for every SKU.");
          }
        }
      } else if (!hasAttributeValue(submittedAttributes.get(row.attributeDefinitionId))) {
        throw new Error("Please complete all required category attributes.");
      }
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
        description: data.description,
        specifications: data.specifications ? data.specifications as Prisma.InputJsonValue : Prisma.JsonNull,
        city: data.city,
        district: data.district,
        contactPhone: data.contactPhone,
        videoUrl: data.videoUrl,
        status: CatalogEntityStatus.DRAFT,
        approvalStatus: ProductApprovalStatus.PENDING,
        localityId: data.localityId,
        neighborhood: data.neighborhood,
        streetAddress: data.streetAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        categories: { create: categoryIds.map((categoryId, index) => ({ categoryId, isPrimary: index === 0, sortOrder: index })) },
        attributes: { create: data.attributes.map((item) => ({
          attributeDefinitionId: item.attributeDefinitionId,
          values: { create: { value: item.value as Prisma.InputJsonValue } }
        })) },
        media: { create: data.media.map((item) => ({ ...item })) },
        propertyDetails: data.propertyDetails ? { create: {
          ...data.propertyDetails,
          floorArea: new Prisma.Decimal(data.propertyDetails.floorArea)
        } } : undefined,
        variants: {
          create: data.variants.map((variant) => ({
            sku: variant.sku, barcode: variant.barcode, name: variant.name, weightGrams: variant.weightGrams,
            optionValues: variant.optionValues as Prisma.InputJsonValue | undefined,
            attributes: {
              create: Object.entries(variant.optionValues ?? {}).map(([key, value]) => {
                const definition = variantAttributesByKey.get(key);
                if (!definition) throw new Error("A submitted variant option does not belong to the selected category.");
                return { attributeDefinitionId: definition.attributeDefinitionId, value: value as Prisma.InputJsonValue };
              })
            },
            prices: { create: variant.prices.map((price) => ({
              marketId: price.marketId, currencyCode: price.currencyCode,
              amountMinor: BigInt(price.amountMinor),
              compareAtMinor: price.compareAtMinor === undefined ? undefined : BigInt(price.compareAtMinor)
            })) }
          }))
        }
      },
      select: { id: true, productNumber: true, storeId: true, name: true, slug: true, status: true, approvalStatus: true }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.created",
      resource: "product", resourceId: product.id, scopeType: "STORE", scopeId: store.id,
      occurredAt: now, metadata: { variantCount: data.variants.length, categoryCount: categoryIds.length, mediaCount: data.media.length }
    }});
    return { ...product, productNumber: product.productNumber.toString() };
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
  if (!(await canManageStoreCatalog(actor.userId, target.store.seller.ownerId, target.storeId, now))) {
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


const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180).optional(),
  description: z.string().trim().max(12000).nullable().optional(),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
  localityId: z.string().trim().min(1).nullable().optional(),
  neighborhood: z.string().trim().max(120).nullable().optional(),
  streetAddress: z.string().trim().max(500).nullable().optional(),
  contactPhone: z.string().trim().min(6).max(40).nullable().optional(),
  videoUrl: z.string().url().max(2048).refine((value) => value.startsWith("https://"), "Video links must use HTTPS.").nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  propertyDetails: z.object({
    propertyType: z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL"]),
    listingType: z.enum(["SALE", "RENT"]),
    bedrooms: z.number().int().min(0).max(100).nullable().optional(),
    bathrooms: z.number().int().min(0).max(100).nullable().optional(),
    floorArea: z.string().regex(/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/)
      .refine((value) => Number(value) > 0, "Floor area must be greater than zero.")
  }).nullable().optional(),
  brandId: z.string().trim().min(1).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1)).max(30).optional(),
  media: z.array(z.object({
    url: z.string().url().max(2048).refine(isSafeCatalogMediaUrl, "Product media URLs must use HTTPS and cannot include credentials."),
    storageKey: z.string().trim().max(1024).nullable().optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]).nullable().optional(),
    width: z.number().int().positive().max(100000).nullable().optional(),
    height: z.number().int().positive().max(100000).nullable().optional(),
    altText: z.string().trim().max(300).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    isPrimary: z.boolean().default(false)
  }).strict()).max(30).optional(),
  variants: z.array(z.object({
    id: z.string().trim().min(1),
    prices: z.array(priceSchema).min(1).max(20)
  }).strict()).min(1).max(100).optional()
}).strict()
  .refine((data) => Object.keys(data).length > 0, "At least one product field must be updated.")
  .refine((data) => !data.media || data.media.filter((item) => item.isPrimary).length <= 1, "Only one primary product image is allowed.");

export type UpdateProductInput = z.input<typeof updateProductSchema>;

/** Updates draft product metadata; edits reset prior review decisions and are audited. */
export async function updateDraftProduct(productId: string, input: UpdateProductInput, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const data = updateProductSchema.parse(input);
  const actor = await requireCurrentSession(now);
  const removedStorageKeys: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({
      where: { id },
      select: { id: true, storeId: true, status: true, latitude: true, longitude: true, localityId: true, neighborhood: true, propertyDetails: { select: { productId: true } }, categories: { select: { category: { select: { id: true, slug: true, parentId: true } } } }, variants: { where: { isActive: true }, select: { id: true } }, store: { select: { status: true, seller: { select: { ownerId: true, status: true } }, markets: { where: { isEnabled: true, market: { status: "ACTIVE", country: { isActive: true } } }, select: { marketId: true } } } } }
    });
    if (!current || current.status !== CatalogEntityStatus.DRAFT) throw new Error("Only draft products can be edited.");
    if (current.store.seller.status !== "ACTIVE" || current.store.status === "SUSPENDED" || current.store.status === "CLOSED") {
      throw new Error("An active seller store is required to manage products.");
    }
    if (!(await canManageStoreCatalog(actor.userId, current.store.seller.ownerId, current.storeId, now))) {
      throw new PermissionDeniedError("You do not have catalog access to this store.");
    }
    if (data.variants !== undefined) {
      const currentVariantIds = new Set(current.variants.map((variant) => variant.id));
      const submittedVariantIds = data.variants.map((variant) => variant.id);
      if (new Set(submittedVariantIds).size !== submittedVariantIds.length ||
          submittedVariantIds.length !== currentVariantIds.size ||
          submittedVariantIds.some((variantId) => !currentVariantIds.has(variantId))) {
        throw new Error("Product price updates must include every active variant exactly once.");
      }
      const enabledMarketIds = new Set(current.store.markets.map((market) => market.marketId));
      const submittedMarketIds = new Set(data.variants.flatMap((variant) => variant.prices.map((price) => price.marketId)));
      if (submittedMarketIds.size !== enabledMarketIds.size ||
          [...enabledMarketIds].some((marketId) => !submittedMarketIds.has(marketId))) {
        throw new Error("Every enabled store market must retain a price for every active variant.");
      }
      const markets = await tx.market.findMany({
        where: { id: { in: [...enabledMarketIds] }, status: "ACTIVE", country: { isActive: true } },
        select: { id: true, currencies: { where: { isEnabled: true, currency: { isActive: true } }, select: { currencyCode: true } } }
      });
      if (markets.length !== enabledMarketIds.size) throw new Error("Every priced market must be active.");
      const enabledPairs = new Set(markets.flatMap((market) => market.currencies.map((currency) => market.id + ":" + currency.currencyCode)));
      for (const variant of data.variants) {
        const marketIds = variant.prices.map((price) => price.marketId);
        if (new Set(marketIds).size !== marketIds.length ||
            marketIds.length !== enabledMarketIds.size ||
            marketIds.some((marketId) => !enabledMarketIds.has(marketId))) {
          throw new Error("Each variant must have exactly one price for every enabled store market.");
        }
        for (const price of variant.prices) {
          if (!enabledPairs.has(price.marketId + ":" + price.currencyCode)) {
            throw new Error("A product price uses a currency not enabled for its market.");
          }
        }
      }
    }
    const nextLocalityId = data.localityId === undefined ? current.localityId : data.localityId;
    const selectedLocality = nextLocalityId
      ? await tx.syriaLocality.findUnique({ where: { id: nextLocalityId }, select: { id: true, governorateId: true } })
      : null;
    if (nextLocalityId && !selectedLocality) throw new Error("The selected Syrian locality is unavailable.");
    if (data.brandId) {
      const brand = await tx.brand.findFirst({ where: { id: data.brandId, status: CatalogEntityStatus.ACTIVE }, select: { id: true } });
      if (!brand) throw new Error("The selected brand is not active.");
    }
    const categoryIds = data.categoryIds === undefined ? undefined : [...new Set(data.categoryIds)];
    if (categoryIds?.length) {
      const count = await tx.category.count({ where: { id: { in: categoryIds }, status: CatalogEntityStatus.ACTIVE } });
      if (count !== categoryIds.length) throw new Error("Every selected category must be active.");
    }
    if (data.propertyDetails !== undefined || data.latitude !== undefined || data.longitude !== undefined || data.localityId !== undefined || categoryIds !== undefined) {
      const selectedCategories = categoryIds === undefined
        ? current.categories.map((entry) => entry.category)
        : await tx.category.findMany({ where: { id: { in: categoryIds }, status: CatalogEntityStatus.ACTIVE }, select: { id: true, slug: true, parentId: true } });
      const isRealEstate = await hasCategoryAncestorSlug(tx, selectedCategories, "real-estate");
      const nextLatitude = data.latitude === undefined ? current.latitude : data.latitude;
      const nextLongitude = data.longitude === undefined ? current.longitude : data.longitude;
      const hasPropertyDetails = data.propertyDetails === undefined ? Boolean(current.propertyDetails) : data.propertyDetails !== null;
      if ((nextLatitude == null) !== (nextLongitude == null)) throw new Error("Latitude and longitude must be supplied together.");
      if (isRealEstate && (!hasPropertyDetails || nextLatitude == null || nextLongitude == null)) {
        throw new Error("Real-estate listings must retain property details and map coordinates.");
      }
      if (!isRealEstate && data.propertyDetails && data.propertyDetails !== null) throw new Error("Property details can only be added to a real-estate listing.");
      if (!isRealEstate && current.propertyDetails) {
        await tx.productPropertyDetails.deleteMany({ where: { productId: id } });
      }
    }
    const changed = await tx.product.updateMany({
      where: { id, status: CatalogEntityStatus.DRAFT },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.district !== undefined ? { district: data.district } : {}),
        ...(data.localityId !== undefined ? { localityId: data.localityId } : {}),
        ...(data.neighborhood !== undefined ? { neighborhood: data.neighborhood } : {}),
        ...(data.streetAddress !== undefined ? { streetAddress: data.streetAddress } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        ...(data.brandId !== undefined ? { brandId: data.brandId } : {}),
        approvalStatus: ProductApprovalStatus.PENDING,
        approvedAt: null,
        rejectionReason: null
      }
    });
    if (changed.count !== 1) throw new Error("Product could not be updated.");
    if (categoryIds !== undefined) {
      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (categoryIds.length) await tx.productCategory.createMany({
        data: categoryIds.map((categoryId, index) => ({ productId: id, categoryId, isPrimary: index === 0, sortOrder: index }))
      });
    }
    if (data.propertyDetails !== undefined) {
      if (data.propertyDetails === null) {
        await tx.productPropertyDetails.deleteMany({ where: { productId: id } });
      } else {
        await tx.productPropertyDetails.upsert({
          where: { productId: id },
          create: { productId: id, ...data.propertyDetails, floorArea: new Prisma.Decimal(data.propertyDetails.floorArea) },
          update: { ...data.propertyDetails, floorArea: new Prisma.Decimal(data.propertyDetails.floorArea) }
        });
      }
    }
    if (data.media !== undefined) {
      const existingMedia = await tx.productMedia.findMany({
        where: { productId: id, type: "IMAGE" },
        select: { storageKey: true }
      });
      const retainedStorageKeys = new Set(data.media.map((item) => item.storageKey).filter((key): key is string => Boolean(key)));
      for (const item of existingMedia) {
        if (item.storageKey && !retainedStorageKeys.has(item.storageKey)) removedStorageKeys.push(item.storageKey);
      }
      await tx.productMedia.deleteMany({ where: { productId: id, type: "IMAGE" } });
      if (data.media.length) {
        await tx.productMedia.createMany({
          data: data.media.map((item) => ({ productId: id, type: "IMAGE", ...item }))
        });
      }
    }
    if (data.variants !== undefined) {
      for (const variant of data.variants) {
        for (const price of variant.prices) {
          await tx.productPrice.deleteMany({
            where: { variantId: variant.id, marketId: price.marketId, currencyCode: { not: price.currencyCode } }
          });
          await tx.productPrice.upsert({
            where: { variantId_marketId_currencyCode: { variantId: variant.id, marketId: price.marketId, currencyCode: price.currencyCode } },
            create: { variantId: variant.id, marketId: price.marketId, currencyCode: price.currencyCode, amountMinor: BigInt(price.amountMinor), compareAtMinor: price.compareAtMinor === undefined ? null : BigInt(price.compareAtMinor) },
            update: { amountMinor: BigInt(price.amountMinor), compareAtMinor: price.compareAtMinor === undefined ? null : BigInt(price.compareAtMinor) }
          });
        }
      }
    }
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.updated",
      resource: "product", resourceId: id, scopeType: "STORE", scopeId: current.storeId,
      occurredAt: now, metadata: { fields: Object.keys(data) }
    }});
    return { productId: id, approvalStatus: ProductApprovalStatus.PENDING };
  });

  // Delete remote assets only after the DB transaction commits. A failed provider
  // deletion is logged for operational follow-up and never rolls back the saved edit.
  for (const storageKey of new Set(removedStorageKeys)) {
    try {
      const retainedAsStoreBranding = await prisma.store.findFirst({
        where: { OR: [{ logoStorageKey: storageKey }, { bannerStorageKey: storageKey }] },
        select: { id: true }
      });
      if (retainedAsStoreBranding) continue;
      const deletion = await deleteProductImage(storageKey);
      if (deletion === "deleted") {
        await prisma.storeMediaAsset.deleteMany({ where: { storageKey } });
      } else {
        console.warn("Product image was unlinked but its provider deletion is not configured.", {
          provider: storageKey.slice(0, storageKey.indexOf(":"))
        });
      }
    } catch (error) {
      console.error("Product image provider deletion failed after unlink.", {
        provider: storageKey.slice(0, storageKey.indexOf(":")),
        message: error instanceof Error ? error.message : "Unknown provider error."
      });
    }
  }
  return result;
}

/** Platform reviewer rejects only pending draft products and must provide a reason. */
export async function rejectProduct(input: { productId: string; reason: string }, now = new Date()) {
  const data = z.object({
    productId: z.string().trim().min(1),
    reason: z.string().trim().min(5).max(2000)
  }).strict().parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: data.productId },
      select: { id: true, storeId: true, status: true, approvalStatus: true }
    });
    if (!product || product.status !== CatalogEntityStatus.DRAFT || product.approvalStatus !== ProductApprovalStatus.PENDING) {
      throw new Error("Only pending draft products can be rejected.");
    }
    const changed = await tx.product.updateMany({
      where: { id: data.productId, status: CatalogEntityStatus.DRAFT, approvalStatus: ProductApprovalStatus.PENDING },
      data: { approvalStatus: ProductApprovalStatus.REJECTED, rejectionReason: data.reason, approvedAt: null }
    });
    if (changed.count !== 1) throw new Error("Product has already been reviewed.");
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.rejected",
      resource: "product", resourceId: product.id, scopeType: "STORE", scopeId: product.storeId,
      occurredAt: now, metadata: { reason: data.reason }
    }});
    return { productId: product.id, approvalStatus: ProductApprovalStatus.REJECTED };
  });
}


/** Lists a seller's own store catalog; delegated staff must hold exact STORE scope. */
export async function listSellerStoreProducts(storeIdInput: string, now = new Date(), searchInput: unknown = {}) {
  const storeId = z.string().trim().min(1).parse(storeIdInput);
  const { q } = z.object({ q: z.string().trim().max(120).optional() }).strict().parse(searchInput);
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, seller: { select: { ownerId: true } } }
  });
  if (!store || !(await canManageStoreCatalog(actor.userId, store.seller.ownerId, store.id, now))) {
    throw new Error("You do not have catalog access to this store.");
  }
  const products = await prisma.product.findMany({
    where: { storeId, ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
      { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" as const } }, { barcode: { contains: q, mode: "insensitive" as const } }] } } }
    ] } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true, productNumber: true, name: true, slug: true, description: true,
      city: true, district: true, contactPhone: true, videoUrl: true,
      localityId: true, neighborhood: true, streetAddress: true, latitude: true, longitude: true,
      propertyDetails: { select: { propertyType: true, listingType: true, bedrooms: true, bathrooms: true, floorArea: true } },
      brand: { select: { id: true, name: true } },
      categories: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { category: { select: { id: true, name: true, slug: true } } } },
      status: true, approvalStatus: true,
      rejectionReason: true, updatedAt: true,
      media: { where: { type: "IMAGE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 10, select: { id: true, url: true, storageKey: true, mimeType: true, width: true, height: true, altText: true, sortOrder: true, isPrimary: true } },
      variants: { where: { isActive: true }, select: { id: true, sku: true, name: true, prices: { select: { marketId: true, currencyCode: true, amountMinor: true, compareAtMinor: true, currency: { select: { minorUnit: true } } } } } }
    }
  });
  return products.map((product) => ({
    ...product,
    productNumber: product.productNumber.toString(),
    propertyDetails: product.propertyDetails ? { ...product.propertyDetails, floorArea: product.propertyDetails.floorArea.toString() } : null,
    variants: product.variants.map((variant) => ({
      ...variant,
      prices: variant.prices.map((price) => ({ ...price, amountMinor: price.amountMinor.toString(), compareAtMinor: price.compareAtMinor?.toString() ?? null }))
    }))
  }));
}


/** Platform-only queue of products awaiting catalog review. */
export async function listPendingProductReviews(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  return prisma.product.findMany({
    where: { status: CatalogEntityStatus.DRAFT, approvalStatus: ProductApprovalStatus.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true, name: true, slug: true, description: true, createdAt: true,
      store: { select: { id: true, name: true, seller: { select: { id: true, displayName: true, legalName: true } } } },
      media: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
      variants: { where: { isActive: true }, select: { id: true, sku: true, prices: { select: { marketId: true, currencyCode: true, amountMinor: true } } } }
    }
  }).then((products) => products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      prices: variant.prices.map((price) => ({ ...price, amountMinor: price.amountMinor.toString() }))
    }))
  })));
}
