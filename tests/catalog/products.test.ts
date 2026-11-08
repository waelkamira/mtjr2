import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  brandFindFirst: vi.fn(),
  categoryCount: vi.fn(),
  categoryFindMany: vi.fn(),
  marketFindMany: vi.fn(),
  productCreate: vi.fn(),
  productFindUnique: vi.fn(),
  productFindUniqueTx: vi.fn(),
  categoryDeleteMany: vi.fn(),
  categoryCreateMany: vi.fn(),
  productUpdateMany: vi.fn(),
  productMapLocationDeleteMany: vi.fn(),
  productMapLocationUpsert: vi.fn(),
  productPropertyDetailsDeleteMany: vi.fn(),
  productPropertyDetailsUpsert: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission: mocks.userHasScopedPermission, userHasPermission: mocks.userHasPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { product: { findUnique: mocks.productFindUnique }, $transaction: mocks.transaction }
}));

import { createDraftProduct, publishProduct, rejectProduct, updateDraftProduct } from "@/server/catalog/products";

describe("product lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" },
      markets: [{ marketId: "market-1" }]
    });
    mocks.brandFindFirst.mockResolvedValue({ id: "brand-1" });
    mocks.categoryCount.mockResolvedValue(1);
    mocks.categoryFindMany.mockResolvedValue([{ slug: "general" }]);
    mocks.marketFindMany.mockResolvedValue([{ id: "market-1", currencies: [{ currencyCode: "EUR" }] }]);
    mocks.productCreate.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    mocks.productFindUnique.mockResolvedValue({ storeId: "store-1", store: { seller: { ownerId: "seller-1" } } });
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "APPROVED", store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }, variants: [{ id: "variant-1", prices: [{ marketId: "market-1", currencyCode: "EUR" }] }], media: [{ id: "media-1" }] });
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      store: { findUnique: mocks.storeFindUnique },
      brand: { findFirst: mocks.brandFindFirst },
      category: { count: mocks.categoryCount, findMany: mocks.categoryFindMany },
      market: { findMany: mocks.marketFindMany },
      productCategory: { deleteMany: mocks.categoryDeleteMany, createMany: mocks.categoryCreateMany },
      productMapLocation: { deleteMany: mocks.productMapLocationDeleteMany, upsert: mocks.productMapLocationUpsert },
      productPropertyDetails: { deleteMany: mocks.productPropertyDetailsDeleteMany, upsert: mocks.productPropertyDetailsUpsert },
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
     description: "Product description",
     city: "Damascus",
     district: "Central",
     contactPhone: "+963900000000",
     categoryIds: ["category-1"], brandId: "brand-1",
      media: [{ url: "https://images.example/mug.jpg", isPrimary: true }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(result).toMatchObject({ id: "product-1", status: "DRAFT", approvalStatus: "PENDING" });
    const createArg = mocks.productCreate.mock.calls[0][0];
    expect(createArg.data.variants.create[0].prices.create[0].amountMinor).toBe(BigInt("2499"));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects a price targeting a market not enabled for the store", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: []
    });
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      description: "Product description",
      city: "Damascus",
      district: "Central",
      contactPhone: "+963900000000",
      categoryIds: ["category-1"],
      media: [{ url: "https://images.example/mug.jpg", isPrimary: true }],
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
        description: "Product description",
        city: "Damascus",
        district: "Central",
        contactPhone: "+963900000000",
      categoryIds: ["category-1"],
        media: [{ url, isPrimary: true }],
        variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
      })).rejects.toThrow(/media URLs must use HTTPS/i);
      expect(mocks.productCreate).not.toHaveBeenCalled();
    }
  );

  it("requires images and a map with property details for real-estate listings", async () => {
    mocks.categoryFindMany.mockResolvedValue([{ slug: "real-estate" }]);
    await expect(createDraftProduct({
      storeId: "store-1",
      name: "City apartment",
      slug: "city-apartment",
     description: "Product description",
     city: "Damascus",
     district: "Central",
     contactPhone: "+963900000000",
      categoryIds: ["category-1"],
      media: [{ url: "https://images.example/home.jpg", isPrimary: true }],
      propertyDetails: { propertyType: "APARTMENT", listingType: "SALE", floorArea: "85.5" },
      variants: [{ sku: "HOME-1", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/map location/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("rejects a zero floor area for real-estate listings", async () => {
    await expect(createDraftProduct({
      storeId: "store-1",
      name: "City apartment",
      slug: "city-apartment",
     description: "Product description",
     city: "Damascus",
     district: "Central",
     contactPhone: "+963900000000",
     categoryIds: ["category-1"],
      mapLocation: { latitude: 33.51381, longitude: 36.27654 },
      media: [{ url: "https://images.example/home.jpg", isPrimary: true }],
      propertyDetails: { propertyType: "APARTMENT", listingType: "SALE", floorArea: "0" },
      variants: [{ sku: "HOME-1", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/floor area must be greater than zero/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stores an exact seller map pin and a rounded public coordinate", async () => {
    await createDraftProduct({
      storeId: "store-1",
      name: "Travel Mug",
      slug: "travel-mug",
      description: "Product description",
      city: "Damascus",
      district: "Central",
      contactPhone: "+963900000000",
      categoryIds: ["category-1"],
      mapLocation: { latitude: 33.51381, longitude: 36.27654 },
      media: [{ url: "https://images.example/mug.jpg", isPrimary: true }],
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    const createArg = mocks.productCreate.mock.calls[0][0];
    expect(createArg.data.mapLocation.create).toEqual({
      latitude: 33.51381,
      longitude: 36.27654,
      publicLatitude: 33.51,
      publicLongitude: 36.28
    });
  });

  it("publishes only with the exact store-scoped catalog permission", async () => {
    const result = await publishProduct("product-1");
    expect(result).toMatchObject({ productId: "product-1", status: "ACTIVE" });
    expect(mocks.requireCurrentSession).toHaveBeenCalledOnce();
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
  });

  it("denies a different seller even when that seller has a global catalog role", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "another-seller" },
      markets: [{ marketId: "market-1" }]
    });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      description: "Product description",
      city: "Damascus",
      district: "Central",
      contactPhone: "+963900000000",
      categoryIds: ["category-1"],
      media: [{ url: "https://images.example/mug.jpg", isPrimary: true }],
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
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", store: { seller: { ownerId: "seller-1" } } });
    mocks.categoryFindMany.mockResolvedValue([{ slug: "general" }]);
    const result = await updateDraftProduct("product-1", { name: "Updated mug", categoryIds: ["category-1"] });
    expect(result.approvalStatus).toBe("PENDING");
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.categoryDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.categoryCreateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("updates all editable listing metadata and stores category fields as JSON", async () => {
    mocks.categoryFindMany.mockResolvedValue([{ slug: "real-estate" }]);
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", store: { seller: { ownerId: "seller-1" } } });
    await updateDraftProduct("product-1", {
      city: "Damascus", district: "Central", contactPhone: "+963900000000",
      videoUrl: "https://video.example/item", customFields: { model: "X1", adType: "SALE", rooms: "2", livingrooms: "1", area: "85.5", propertyType: "APARTMENT", bathrooms: "1" }, categoryIds: ["category-1"],
      mapLocation: { latitude: 33.5, longitude: 36.2 },
      propertyDetails: { propertyType: "APARTMENT", listingType: "SALE", floorArea: "85.5" }
    });
    const updateData = mocks.productUpdateMany.mock.calls[0][0].data;
    expect(updateData).toMatchObject({ city: "Damascus", district: "Central", contactPhone: "+963900000000", videoUrl: "https://video.example/item" });
    expect(updateData.customFields).toMatchObject({ model: "X1", adType: "SALE", propertyType: "APARTMENT" });
    expect(mocks.productMapLocationUpsert).toHaveBeenCalledOnce();
    expect(mocks.productPropertyDetailsUpsert).toHaveBeenCalledOnce();
  });

  it("rejects a pending draft with a required reason and audit event", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    const result = await rejectProduct({ productId: "product-1", reason: "Missing compliance details." });
    expect(result.approvalStatus).toBe("REJECTED");
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

});
