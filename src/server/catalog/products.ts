import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma, ProductApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { requirePermission } from "@/server/identity/permission-guard";
import { isSafeCatalogMediaUrl } from "@/server/catalog/media-url";
import { getCategoryFieldPresets } from "@/lib/catalog/category-field-presets";

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
  description: z.string().trim().min(1).max(12000),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(6).max(40),
  videoUrl: z.string().url().max(2048).refine((value) => value.startsWith("https://"), "Video links must use HTTPS.").optional(),
  customFields: z.record(z.string().trim().min(1).max(100), z.unknown()).optional(),
  initialStock: z.number().int().min(0).max(100000000).default(0),
  brandId: z.string().trim().min(1).optional(),
  categoryIds: z.array(z.string().trim().min(1)).min(1).max(30),
  mapLocation: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180)
  }).optional(),
  propertyDetails: z.object({
    propertyType: z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL"]),
    listingType: z.enum(["SALE", "RENT"]),
    bedrooms: z.number().int().min(0).max(100).nullable().optional(),
    bathrooms: z.number().int().min(0).max(100).nullable().optional(),
    floorArea: z.string()
      .regex(/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/)
      .refine((value) => Number(value) > 0, "Floor area must be greater than zero.")
  }).optional(),
  media: z.array(z.object({
    url: z.string().url().max(2048).refine(isSafeCatalogMediaUrl, "Product media URLs must use HTTPS and cannot include credentials."),
    storageKey: z.string().trim().min(1).max(512).optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
    width: z.number().int().min(1).max(100000).optional(),
    height: z.number().int().min(1).max(100000).optional(),
    altText: z.string().trim().max(300).optional(),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    isPrimary: z.boolean().default(false)
  })).min(1).max(8),
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

export async function canManageStoreCatalog(userId: string, ownerId: string, storeId: string, now: Date) {
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
      select: { id: true, status: true, seller: { select: { status: true, ownerId: true } }, markets: { where: { isEnabled: true }, select: { marketId: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") {
      throw new Error("An active seller store is required to manage products.");
    }
    if (!(await canManageStoreCatalog(actor.userId, store.seller.ownerId, store.id, now))) {
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
    const categories = categoryIds.length
      ? await tx.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, slug: true } })
      : [];
    const primaryCategorySlug = categories.find((category) => category.id === categoryIds[0])?.slug;
    const requiredCategoryFields = primaryCategorySlug ? getCategoryFieldPresets(primaryCategorySlug) : [];
    const missingCategoryFields = requiredCategoryFields.filter((field) => {
      const value = data.customFields?.[field.key];
      return typeof value !== "string" || !value.trim();
    });
    if (missingCategoryFields.length) {
      throw new Error("Complete all required category-specific product details: " + missingCategoryFields.map((field) => field.label).join(", "));
    }
    const isRealEstate = categories.some((category) => category.slug === "real-estate");
    if (isRealEstate && (!data.propertyDetails || !data.mapLocation)) {
      throw new Error("Real estate listings need property details and a map location.");
    }
    if (!isRealEstate && data.propertyDetails) {
      throw new Error("Property details can only be added to a real-estate listing.");
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
        city: data.city || null, district: data.district || null,
        contactPhone: data.contactPhone || null, videoUrl: data.videoUrl || null,
        customFields: data.customFields ? (data.customFields as Prisma.InputJsonValue) : undefined,
        status: CatalogEntityStatus.DRAFT,
        approvalStatus: ProductApprovalStatus.PENDING,
        categories: { create: categoryIds.map((categoryId, index) => ({ categoryId, isPrimary: index === 0, sortOrder: index })) },
        media: { create: data.media.map((item) => ({ ...item })) },
        mapLocation: data.mapLocation ? { create: {
          latitude: data.mapLocation.latitude,
          longitude: data.mapLocation.longitude,
          publicLatitude: Math.round(data.mapLocation.latitude * 100) / 100,
          publicLongitude: Math.round(data.mapLocation.longitude * 100) / 100
        } } : undefined,
        propertyDetails: data.propertyDetails ? { create: {
          ...data.propertyDetails,
          floorArea: new Prisma.Decimal(data.propertyDetails.floorArea)
        } } : undefined,
        variants: {
          create: data.variants.map((variant) => ({
            sku: variant.sku, barcode: variant.barcode, name: variant.name, weightGrams: variant.weightGrams,
            optionValues: variant.optionValues as Prisma.InputJsonValue | undefined,
            prices: { create: variant.prices.map((price) => ({
              marketId: price.marketId, currencyCode: price.currencyCode,
              amountMinor: BigInt(price.amountMinor),
              compareAtMinor: price.compareAtMinor === undefined ? undefined : BigInt(price.compareAtMinor)
            })) }
          }))
        }
      },
      select: { id: true, storeId: true, name: true, slug: true, status: true, approvalStatus: true, variants: { select: { id: true } } }
    });
    if (data.initialStock > 0) {
      let warehouse = await tx.warehouse.findFirst({ where: { storeId: store.id, code: "MAIN" }, select: { id: true, isActive: true } });
      if (!warehouse) warehouse = await tx.warehouse.create({ data: { storeId: store.id, code: "MAIN", name: "Main warehouse", isActive: true }, select: { id: true, isActive: true } });
      else if (!warehouse.isActive) warehouse = await tx.warehouse.update({ where: { id: warehouse.id }, data: { isActive: true }, select: { id: true, isActive: true } });
      for (const variant of product.variants) {
        await tx.inventory.create({ data: { warehouseId: warehouse.id, variantId: variant.id, quantityOnHand: data.initialStock, quantityReserved: 0, quantityQuarantined: 0, reorderPoint: 0 } });
      }
    }
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.created",
      resource: "product", resourceId: product.id, scopeType: "STORE", scopeId: store.id,
      occurredAt: now, metadata: { variantCount: data.variants.length, categoryCount: categoryIds.length, mediaCount: data.media.length, initialStock: data.initialStock }
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
  city: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
  contactPhone: z.string().trim().min(6).max(40).nullable().optional(),
  videoUrl: z.string().url().max(2048).refine((value) => value.startsWith("https://"), "Video links must use HTTPS.").nullable().optional(),
  customFields: z.record(z.string().trim().min(1).max(100), z.unknown()).nullable().optional(),
  brandId: z.string().trim().min(1).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1)).min(1).max(30).optional(),
  mapLocation: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180)
  }).nullable().optional(),
  propertyDetails: z.object({
    propertyType: z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL"]),
    listingType: z.enum(["SALE", "RENT"]),
    bedrooms: z.number().int().min(0).max(100).nullable().optional(),
    bathrooms: z.number().int().min(0).max(100).nullable().optional(),
    floorArea: z.string().regex(/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/)
      .refine((value) => Number(value) > 0, "Floor area must be greater than zero.")
  }).nullable().optional()
}).strict().refine((data) => Object.keys(data).length > 0, "At least one product field must be updated.");

export type UpdateProductInput = z.input<typeof updateProductSchema>;

/** Updates draft product metadata; edits reset prior review decisions and are audited. */
export async function updateDraftProduct(productId: string, input: UpdateProductInput, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const data = updateProductSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({
      where: { id },
      select: {
        id: true, storeId: true, status: true, customFields: true,
        categories: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: { category: { select: { id: true, slug: true } } }
        },
        mapLocation: { select: { productId: true } },
        propertyDetails: { select: { productId: true } },
        store: { select: { seller: { select: { ownerId: true } } } }
      }
    });
    if (!current || current.status !== CatalogEntityStatus.DRAFT) throw new Error("Only draft products can be edited.");
    if (!(await canManageStoreCatalog(actor.userId, current.store.seller.ownerId, current.storeId, now))) {
      throw new Error("You do not have catalog access to this store.");
    }
    if (data.brandId) {
      const brand = await tx.brand.findFirst({ where: { id: data.brandId, status: CatalogEntityStatus.ACTIVE }, select: { id: true } });
      if (!brand) throw new Error("The selected brand is not active.");
    }
    const categoryIds = data.categoryIds === undefined ? undefined : [...new Set(data.categoryIds)];
    let selectedCategorySlugs = (current.categories ?? []).map((entry) => entry.category.slug);
    if (categoryIds !== undefined) {
      if (categoryIds.length) {
        const count = await tx.category.count({ where: { id: { in: categoryIds }, status: CatalogEntityStatus.ACTIVE } });
        if (count !== categoryIds.length) throw new Error("Every selected category must be active.");
        const selectedCategories = await tx.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, slug: true } });
        selectedCategorySlugs = categoryIds.map((categoryId) => selectedCategories.find((category) => category.id === categoryId)?.slug).filter((slug): slug is string => Boolean(slug));
      } else {
        selectedCategorySlugs = [];
      }
    }
    const isRealEstate = selectedCategorySlugs.includes("real-estate");
    const effectiveCustomFields = data.customFields === undefined ? current.customFields : data.customFields;
    const primaryCategorySlug = selectedCategorySlugs[0];
    const requiredFields = primaryCategorySlug ? getCategoryFieldPresets(primaryCategorySlug) : [];
    const missingFields = requiredFields.filter((field) => {
      const value = effectiveCustomFields && typeof effectiveCustomFields === "object"
        ? (effectiveCustomFields as Record<string, unknown>)[field.key]
        : undefined;
      return typeof value !== "string" || !value.trim();
    });
    if (missingFields.length) throw new Error("Complete all required category-specific product details: " + missingFields.map((field) => field.label).join(", "));
    const hasMapLocation = data.mapLocation !== undefined ? data.mapLocation !== null : Boolean(current.mapLocation);
    const hasPropertyDetails = data.propertyDetails !== undefined ? data.propertyDetails !== null : Boolean(current.propertyDetails);
    if (isRealEstate && (!hasMapLocation || !hasPropertyDetails)) {
      throw new Error("Real estate listings need property details and a map location.");
    }
    if (!isRealEstate && data.propertyDetails) {
      throw new Error("Property details can only be added to a real-estate listing.");
    }
    const changed = await tx.product.updateMany({
      where: { id, status: CatalogEntityStatus.DRAFT },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.district !== undefined ? { district: data.district } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(data.customFields !== undefined ? { customFields: data.customFields === null ? Prisma.DbNull : data.customFields as Prisma.InputJsonValue } : {}),
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
    if (data.mapLocation !== undefined) {
      if (data.mapLocation === null) await tx.productMapLocation.deleteMany({ where: { productId: id } });
      else await tx.productMapLocation.upsert({
        where: { productId: id },
        create: { productId: id, latitude: data.mapLocation.latitude, longitude: data.mapLocation.longitude, publicLatitude: Math.round(data.mapLocation.latitude * 100) / 100, publicLongitude: Math.round(data.mapLocation.longitude * 100) / 100 },
        update: { latitude: data.mapLocation.latitude, longitude: data.mapLocation.longitude, publicLatitude: Math.round(data.mapLocation.latitude * 100) / 100, publicLongitude: Math.round(data.mapLocation.longitude * 100) / 100 }
      });
    }
    if (data.propertyDetails !== undefined) {
      if (data.propertyDetails === null) await tx.productPropertyDetails.deleteMany({ where: { productId: id } });
      else await tx.productPropertyDetails.upsert({
        where: { productId: id },
        create: { productId: id, ...data.propertyDetails, floorArea: new Prisma.Decimal(data.propertyDetails.floorArea) },
        update: { ...data.propertyDetails, floorArea: new Prisma.Decimal(data.propertyDetails.floorArea) }
      });
    } else if (categoryIds !== undefined && !isRealEstate && current.propertyDetails) {
      await tx.productPropertyDetails.deleteMany({ where: { productId: id } });
    }
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "catalog.product.updated",
      resource: "product", resourceId: id, scopeType: "STORE", scopeId: current.storeId,
      occurredAt: now, metadata: { fields: Object.keys(data) }
    }});
    return { productId: id, approvalStatus: ProductApprovalStatus.PENDING };
  });
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
      id: true, name: true, slug: true, description: true, city: true, district: true, contactPhone: true, videoUrl: true, customFields: true, brandId: true, status: true, approvalStatus: true,
      rejectionReason: true, updatedAt: true,
      mapLocation: { select: { latitude: true, longitude: true } },
      propertyDetails: true,
      categories: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { category: { select: { id: true, name: true, slug: true } } } },
      media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 8, select: { url: true, altText: true, isPrimary: true } },
      variants: { where: { isActive: true }, select: { id: true, sku: true, name: true, prices: { select: { marketId: true, currencyCode: true, amountMinor: true } } } }
    }
  });
  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      prices: variant.prices.map((price) => ({ ...price, amountMinor: price.amountMinor.toString() }))
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
      propertyDetails: true,
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
