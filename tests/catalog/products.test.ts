import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  storeFindFirst: vi.fn(),
  storeMediaAssetDeleteMany: vi.fn(),
  brandFindFirst: vi.fn(),
  categoryCount: vi.fn(),
  categoryFindMany: vi.fn(),
  categoryAttributeFindMany: vi.fn(),
  localityFindUnique: vi.fn(),
  marketFindMany: vi.fn(),
  productCreate: vi.fn(),
  productFindUnique: vi.fn(),
  productFindUniqueTx: vi.fn(),
  categoryDeleteMany: vi.fn(),
  categoryCreateMany: vi.fn(),
  productUpdateMany: vi.fn(),
  productPropertyDetailsUpsert: vi.fn(),
  productPropertyDetailsDeleteMany: vi.fn(),
  productMediaFindMany: vi.fn(),
  productMediaDeleteMany: vi.fn(),
  productMediaCreateMany: vi.fn(),
  deleteProductImage: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/media/product-image-deletion", () => ({ deleteProductImage: mocks.deleteProductImage }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission: mocks.userHasScopedPermission, userHasPermission: mocks.userHasPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { product: { findUnique: mocks.productFindUnique }, store: { findFirst: mocks.storeFindFirst }, storeMediaAsset: { deleteMany: mocks.storeMediaAssetDeleteMany }, $transaction: mocks.transaction }
}));

import { approveProduct, createDraftProduct, publishProduct, rejectProduct, updateDraftProduct } from "@/server/catalog/products";

describe("product lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.storeFindFirst.mockResolvedValue(null);
    mocks.storeMediaAssetDeleteMany.mockResolvedValue({ count: 1 });
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" },
      markets: [{ marketId: "market-1" }]
    });
    mocks.brandFindFirst.mockResolvedValue({ id: "brand-1" });
    mocks.categoryCount.mockResolvedValue(1);
    mocks.categoryFindMany.mockResolvedValue([{ id: "category-1", slug: "general" }]);
    mocks.categoryAttributeFindMany.mockResolvedValue([]);
    mocks.localityFindUnique.mockResolvedValue(null);
    mocks.marketFindMany.mockResolvedValue([{ id: "market-1", currencies: [{ currencyCode: "EUR" }] }]);
    mocks.productCreate.mockResolvedValue({ id: "product-1", productNumber: BigInt("101"), storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    mocks.productFindUnique.mockResolvedValue({ storeId: "store-1", store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] } });
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "APPROVED", latitude: null, longitude: null, categories: [{ category: { slug: "general" } }], store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }, variants: [{ id: "variant-1", prices: [{ marketId: "market-1", currencyCode: "EUR" }] }], media: [{ id: "media-1" }] });
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });
    mocks.productMediaFindMany.mockResolvedValue([]);
    mocks.deleteProductImage.mockResolvedValue("deleted");
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      store: { findUnique: mocks.storeFindUnique },
      brand: { findFirst: mocks.brandFindFirst },
      category: { count: mocks.categoryCount, findMany: mocks.categoryFindMany },
      categoryAttribute: { findMany: mocks.categoryAttributeFindMany },
      syriaLocality: { findUnique: mocks.localityFindUnique },
      market: { findMany: mocks.marketFindMany },
      productCategory: { deleteMany: mocks.categoryDeleteMany, createMany: mocks.categoryCreateMany },
      productPropertyDetails: { upsert: mocks.productPropertyDetailsUpsert, deleteMany: mocks.productPropertyDetailsDeleteMany },
      productMedia: { findMany: mocks.productMediaFindMany, deleteMany: mocks.productMediaDeleteMany, createMany: mocks.productMediaCreateMany },
      product: {
        create: mocks.productCreate,
        findUnique: mocks.productFindUniqueTx,
        updateMany: mocks.productUpdateMany
      },
      auditLog: { create: mocks.auditCreate }
    } as unknown as Prisma.TransactionClient));
  });

  it("creates variants and minor-unit prices atomically in the store's enabled market", async () => {
    const result = await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"], brandId: "brand-1",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(result).toMatchObject({ id: "product-1", productNumber: "101", status: "DRAFT", approvalStatus: "PENDING" });
    const createArg = mocks.productCreate.mock.calls[0][0];
    expect(createArg.data.variants.create[0].prices.create[0].amountMinor).toBe(BigInt("2499"));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("persists localized SEO metadata, a selected brand and variant shipping weight", async () => {
    await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      locale: "ar", seoTitle: "كوب حراري للسفر", seoDescription: "كوب حراري يحافظ على المشروبات ساخنة وباردة.",
      brandId: "brand-1",
      variants: [{
        sku: "MUG-BLK", weightGrams: 350,
        prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }]
      }]
    });
    const data = mocks.productCreate.mock.calls[0][0].data;
    expect(data.brandId).toBe("brand-1");
    expect(data.translations.create).toMatchObject({
      locale: "ar", name: "Travel Mug",
      seoTitle: "كوب حراري للسفر",
      seoDescription: "كوب حراري يحافظ على المشروبات ساخنة وباردة."
    });
    expect(data.variants.create[0].weightGrams).toBe(350);
  });

  it("creates multiple distinct SKU variants with their own required category options", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-size",
      isRequired: true,
      isVariantLevel: true,
      options: ["S", "M", "L"],
      attribute: { key: "size", valueType: "SELECT" }
    }]);
    await createDraftProduct({
      storeId: "store-1", name: "Cotton Shirt", slug: "cotton-shirt",
      categoryIds: ["category-1"],
      variants: [
        { sku: "SHIRT-S", optionValues: { size: "S" }, prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] },
        { sku: "SHIRT-M", optionValues: { size: "M" }, prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2699" }] }
      ]
    });
    const variants = mocks.productCreate.mock.calls[0][0].data.variants.create;
    expect(variants).toHaveLength(2);
    expect(variants.map((variant: { sku: string }) => variant.sku)).toEqual(["SHIRT-S", "SHIRT-M"]);
    expect(variants.map((variant: { attributes: { create: Array<{ value: string }> } }) => variant.attributes.create[0].value)).toEqual(["S", "M"]);
    expect(variants.map((variant: { prices: { create: Array<{ amountMinor: bigint }> } }) => variant.prices.create[0].amountMinor)).toEqual([BigInt("2499"), BigInt("2699")]);
  });

  it("rejects a multi-variant product when any SKU omits a required variant option", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-size",
      isRequired: true,
      isVariantLevel: true,
      options: ["S", "M", "L"],
      attribute: { key: "size", valueType: "SELECT" }
    }]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Cotton Shirt", slug: "cotton-shirt",
      categoryIds: ["category-1"],
      variants: [
        { sku: "SHIRT-S", optionValues: { size: "S" }, prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] },
        { sku: "SHIRT-M", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }
      ]
    })).rejects.toThrow(/required variant options/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("persists structured property details while using the existing private product coordinates", async () => {
    mocks.categoryFindMany.mockResolvedValue([{ id: "category-1", slug: "real-estate" }]);
    await createDraftProduct({
      storeId: "store-1", name: "City apartment", slug: "city-apartment",
      categoryIds: ["category-1"],
      city: "Damascus", district: "Mazzeh", contactPhone: "+963900000000",
      videoUrl: "https://video.example/listing",
      latitude: 33.51381, longitude: 36.27654,
      propertyDetails: { propertyType: "APARTMENT", listingType: "SALE", bedrooms: 2, bathrooms: 1, floorArea: "85.50" },
      variants: [{ sku: "HOME-1", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "12000000" }] }]
    });
    const data = mocks.productCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      city: "Damascus", district: "Mazzeh", contactPhone: "+963900000000",
      videoUrl: "https://video.example/listing", latitude: 33.51381, longitude: 36.27654,
      propertyDetails: { create: { propertyType: "APARTMENT", listingType: "SALE", bedrooms: 2, bathrooms: 1 } }
    });
    expect(data.propertyDetails.create.floorArea.toString()).toBe("85.5");
  });

  it("requires coordinates and structured details for real-estate drafts", async () => {
    mocks.categoryFindMany.mockResolvedValue([{ id: "category-1", slug: "real-estate" }]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "City apartment", slug: "city-apartment",
      categoryIds: ["category-1"],
      propertyDetails: { propertyType: "APARTMENT", listingType: "SALE", floorArea: "85.5" },
      variants: [{ sku: "HOME-1", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "12000000" }] }]
    })).rejects.toThrow(/property details and map coordinates/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("rejects property details for non-real-estate categories", async () => {
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      propertyDetails: { propertyType: "APARTMENT", listingType: "SALE", floorArea: "20" },
      variants: [{ sku: "MUG-1", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/only be added to a real-estate listing/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("updates structured property details transactionally", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT", latitude: 33.5, longitude: 36.2,
      categories: [{ category: { slug: "real-estate" } }],
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }
    });
    await updateDraftProduct("product-1", {
      propertyDetails: { propertyType: "HOUSE", listingType: "RENT", bedrooms: 3, bathrooms: 2, floorArea: "120" },
      contactPhone: "+963900000000", videoUrl: "https://video.example/house"
    });
    expect(mocks.productPropertyDetailsUpsert).toHaveBeenCalledOnce();
    expect(mocks.productUpdateMany.mock.calls[0][0].data).toMatchObject({
      contactPhone: "+963900000000", videoUrl: "https://video.example/house"
    });
  });

  it("validates and persists category-scoped typed attributes", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-color",
      isRequired: true,
      options: ["Black", "Blue"],
      attribute: { valueType: "SELECT" }
    }]);
    await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      attributes: [{ attributeDefinitionId: "attribute-color", value: "Black" }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(mocks.productCreate.mock.calls[0][0].data.attributes.create).toEqual([{
      attributeDefinitionId: "attribute-color",
      values: { create: { value: "Black" } }
    }]);
  });

  it("validates and persists variant-level category options on the SKU", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-size",
      isRequired: true,
      isVariantLevel: true,
      options: ["S", "M", "L"],
      attribute: { key: "size", valueType: "SELECT" }
    }]);
    await createDraftProduct({
      storeId: "store-1", name: "Cotton Shirt", slug: "cotton-shirt",
      categoryIds: ["category-1"],
      variants: [{
        sku: "SHIRT-M",
        optionValues: { size: "M" },
        prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }]
      }]
    });
    const variant = mocks.productCreate.mock.calls[0][0].data.variants.create[0];
    expect(variant.attributes.create).toEqual([{
      attributeDefinitionId: "attribute-size",
      value: "M"
    }]);
  });

  it("rejects category attributes that are not configured for the selected category", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      attributes: [{ attributeDefinitionId: "foreign-attribute", value: "anything" }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/does not belong to the selected category/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("requires mandatory category fields before creating a draft", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-color",
      isRequired: true,
      options: ["Black", "Blue"],
      attribute: { valueType: "SELECT" }
    }]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/required category attributes/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("persists a selected Syrian locality and map coordinates", async () => {
    mocks.localityFindUnique.mockResolvedValue({ id: "sy-locality-1", governorateId: "sy-damascus" });
    await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      localityId: "sy-locality-1", neighborhood: "المزة", streetAddress: "شارع الجلاء، بناء ١٢",
      latitude: 33.505004, longitude: 36.278227,
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(mocks.productCreate.mock.calls[0][0].data).toMatchObject({
      localityId: "sy-locality-1", neighborhood: "المزة", streetAddress: "شارع الجلاء، بناء ١٢",
      latitude: 33.505004, longitude: 36.278227
    });
  });

  it("persists a seller-entered neighbourhood label without a separate geographic record", async () => {
    mocks.localityFindUnique.mockResolvedValue({ id: "sy-locality-1", governorateId: "sy-damascus" });
    await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      localityId: "sy-locality-1", neighborhood: "المزة",
      latitude: 33.505004, longitude: 36.278227,
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(mocks.productCreate.mock.calls[0][0].data).toMatchObject({
      localityId: "sy-locality-1", neighborhood: "المزة",
      latitude: 33.505004, longitude: 36.278227
    });
  });



  it("rejects category select values outside the configured option set", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-color",
      isRequired: true,
      options: ["Black", "Blue"],
      attribute: { valueType: "SELECT" }
    }]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      attributes: [{ attributeDefinitionId: "attribute-color", value: "Red" }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/selected attribute value is invalid/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("rejects overlong text and duplicate multi-select attribute values", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-description",
      isRequired: true,
      options: null,
      attribute: { valueType: "TEXT" }
    }]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      attributes: [{ attributeDefinitionId: "attribute-description", value: "x".repeat(2001) }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/2,000 characters/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("rejects duplicate values in a category multi-select field", async () => {
    mocks.categoryAttributeFindMany.mockResolvedValue([{
      attributeDefinitionId: "attribute-features",
      isRequired: true,
      options: ["Insulated", "Leakproof"],
      attribute: { valueType: "MULTI_SELECT" }
    }]);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"],
      attributes: [{ attributeDefinitionId: "attribute-features", value: ["Insulated", "Insulated"] }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/multi-select attribute value is invalid/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("rejects a price targeting a market not enabled for the store", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: []
    });
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/enabled for this store/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it.each(["http://example.test/mug.jpg", "https://user:secret@example.test/mug.jpg"])(
    "rejects unsafe product media URL %s",
    async (url) => {
      await expect(createDraftProduct({
        storeId: "store-1",
        name: "Travel Mug",
        slug: "travel-mug",
        media: [{ url, isPrimary: true }],
        variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
      })).rejects.toThrow(/media URLs must use HTTPS/i);
      expect(mocks.productCreate).not.toHaveBeenCalled();
    }
  );

  it("publishes only with the exact store-scoped catalog permission", async () => {
    const result = await publishProduct("product-1");
    expect(result).toMatchObject({ productId: "product-1", status: "ACTIVE" });
    expect(mocks.requireCurrentSession).toHaveBeenCalledOnce();
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
  });

  it("approves only a pending draft and records the reviewer audit event", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING"
    });

    const result = await approveProduct("product-1");

    expect(result).toEqual({ productId: "product-1", approvalStatus: "APPROVED" });
    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage", now: expect.any(Date) });
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "product-1", status: "DRAFT", approvalStatus: "PENDING" },
      data: expect.objectContaining({ approvalStatus: "APPROVED" })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("does not approve a product that is already reviewed or published", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "ACTIVE", approvalStatus: "APPROVED"
    });

    await expect(approveProduct("product-1")).rejects.toThrow(/only pending draft products/i);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses to publish a pending product even when its store and listing data are otherwise valid", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING",
      store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] },
      variants: [{ id: "variant-1", prices: [{ marketId: "market-1", currencyCode: "EUR" }] }],
      media: [{ id: "media-1" }]
    });

    await expect(publishProduct("product-1")).rejects.toThrow(/only approved draft products/i);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses to publish when a primary image or active variant is missing", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "APPROVED",
      store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] },
      variants: [],
      media: []
    });

    await expect(publishProduct("product-1")).rejects.toThrow(/active variant and a primary image/i);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses to publish when any active variant lacks a valid price in an enabled market", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "APPROVED",
      store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] },
      variants: [{ id: "variant-1", prices: [] }],
      media: [{ id: "media-1" }]
    });

    await expect(publishProduct("product-1")).rejects.toThrow(/every active variant needs a price/i);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });

  it("denies a different seller even when that seller has a global catalog role", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "another-seller" },
      markets: [{ marketId: "market-1" }]
    });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/catalog access/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("allows a delegated manager only through an exact store grant", async () => {
    mocks.productFindUnique.mockResolvedValue({ storeId: "store-1", store: { seller: { ownerId: "another-seller" } } });
    mocks.userHasScopedPermission.mockResolvedValue(true);
    await publishProduct("product-1");
    expect(mocks.userHasScopedPermission).toHaveBeenCalledWith("seller-1", expect.objectContaining({
      permissionKey: "catalog:manage", scope: { type: "STORE", id: "store-1" }
    }));
  });

  it("updates draft metadata and resets review status for a fresh review", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] } });
    const result = await updateDraftProduct("product-1", { name: "Updated mug", categoryIds: ["category-1"] });
    expect(result.approvalStatus).toBe("PENDING");
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.categoryDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.categoryCreateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("validates and persists locality and neighbourhood changes when editing a draft", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT",
      neighborhood: "الحي القديم", categories: [{ category: { id: "category-1", slug: "phones-electronics", parentId: null } }],
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }
    });
    mocks.localityFindUnique.mockResolvedValue({ id: "new-locality", governorateId: "sy-damascus" });

    await updateDraftProduct("product-1", {
      neighborhood: "المزة", latitude: 33.505, longitude: 36.278
    });

    expect(mocks.productUpdateMany.mock.calls[0][0].data).toMatchObject({
      neighborhood: "المزة", latitude: 33.505, longitude: 36.278
    });
  });



  it("replaces draft product images and deletes removed provider assets after commit", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT",
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }
    });
    mocks.productMediaFindMany.mockResolvedValue([
      { storageKey: "imgur:old-delete-hash" },
      { storageKey: "imagekit:retained-file" }
    ]);

    await updateDraftProduct("product-1", {
      media: [{
        url: "https://ik.imagekit.io/demo/new.jpg",
        storageKey: "imagekit:retained-file",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isPrimary: true
      }]
    });

    expect(mocks.productMediaDeleteMany).toHaveBeenCalledWith({
      where: { productId: "product-1", type: "IMAGE" }
    });
    expect(mocks.productMediaCreateMany).toHaveBeenCalledOnce();
    expect(mocks.deleteProductImage).toHaveBeenCalledOnce();
    expect(mocks.deleteProductImage).toHaveBeenCalledWith("imgur:old-delete-hash");
  });

  it("does not delete provider images when the product update transaction fails", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT",
      store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }
    });
    mocks.productMediaFindMany.mockResolvedValue([{ storageKey: "imgur:old-delete-hash" }]);
    mocks.transaction.mockRejectedValueOnce(new Error("database transaction failed"));

    await expect(updateDraftProduct("product-1", { media: [] })).rejects.toThrow(/database transaction failed/i);
    expect(mocks.deleteProductImage).not.toHaveBeenCalled();
  });

  it("rejects a pending draft with a required reason and audit event", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    const result = await rejectProduct({ productId: "product-1", reason: "Missing compliance details." });
    expect(result.approvalStatus).toBe("REJECTED");
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

});
