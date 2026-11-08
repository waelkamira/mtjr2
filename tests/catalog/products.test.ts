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
  categoryAttributeFindMany: vi.fn(),
  localityFindUnique: vi.fn(),
  neighborhoodFindUnique: vi.fn(),
  marketFindMany: vi.fn(),
  productCreate: vi.fn(),
  productFindUnique: vi.fn(),
  productFindUniqueTx: vi.fn(),
  categoryDeleteMany: vi.fn(),
  categoryCreateMany: vi.fn(),
  productUpdateMany: vi.fn(),
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
    mocks.categoryAttributeFindMany.mockResolvedValue([]);
    mocks.localityFindUnique.mockResolvedValue(null);
    mocks.neighborhoodFindUnique.mockResolvedValue(null);
    mocks.marketFindMany.mockResolvedValue([{ id: "market-1", currencies: [{ currencyCode: "EUR" }] }]);
    mocks.productCreate.mockResolvedValue({ id: "product-1", productNumber: BigInt("101"), storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    mocks.productFindUnique.mockResolvedValue({ storeId: "store-1", store: { seller: { ownerId: "seller-1" } } });
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "APPROVED", store: { status: "ACTIVE", seller: { status: "ACTIVE", ownerId: "seller-1" }, markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }] }, variants: [{ id: "variant-1", prices: [{ marketId: "market-1", currencyCode: "EUR" }] }], media: [{ id: "media-1" }] });
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });
    mocks.productMediaFindMany.mockResolvedValue([]);
    mocks.deleteProductImage.mockResolvedValue("deleted");
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      store: { findUnique: mocks.storeFindUnique },
      brand: { findFirst: mocks.brandFindFirst },
      category: { count: mocks.categoryCount },
      categoryAttribute: { findMany: mocks.categoryAttributeFindMany },
      syriaLocality: { findUnique: mocks.localityFindUnique },
      syriaNeighborhood: { findUnique: mocks.neighborhoodFindUnique },
      market: { findMany: mocks.marketFindMany },
      productCategory: { deleteMany: mocks.categoryDeleteMany, createMany: mocks.categoryCreateMany },
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
      localityId: "sy-locality-1", neighborhood: "المزة",
      latitude: 33.505004, longitude: 36.278227,
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(mocks.productCreate.mock.calls[0][0].data).toMatchObject({
      localityId: "sy-locality-1", neighborhood: "المزة",
      latitude: 33.505004, longitude: 36.278227
    });
  });

  it("persists the selected neighbourhood reference only within its governorate", async () => {
    mocks.localityFindUnique.mockResolvedValue({ id: "sy-locality-1", governorateId: "sy-damascus" });
    mocks.neighborhoodFindUnique.mockResolvedValue({ id: "akaar-n-1", governorateId: "sy-damascus" });
    await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      localityId: "sy-locality-1", neighborhoodId: "akaar-n-1", neighborhood: "المزة",
      latitude: 33.505004, longitude: 36.278227,
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(mocks.productCreate.mock.calls[0][0].data).toMatchObject({
      localityId: "sy-locality-1", neighborhoodId: "akaar-n-1", neighborhood: "المزة"
    });
  });

  it("rejects a neighbourhood from another governorate", async () => {
    mocks.localityFindUnique.mockResolvedValue({ id: "sy-locality-1", governorateId: "sy-damascus" });
    mocks.neighborhoodFindUnique.mockResolvedValue({ id: "akaar-n-2", governorateId: "sy-aleppo" });
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      localityId: "sy-locality-1", neighborhoodId: "akaar-n-2", neighborhood: "حي بعيد",
      latitude: 33.505004, longitude: 36.278227,
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/does not belong to the selected governorate/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
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
    mocks.productFindUniqueTx.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", store: { seller: { ownerId: "seller-1" } } });
    const result = await updateDraftProduct("product-1", { name: "Updated mug", categoryIds: ["category-1"] });
    expect(result.approvalStatus).toBe("PENDING");
    expect(mocks.productUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.categoryDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.categoryCreateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("replaces draft product images and deletes removed provider assets after commit", async () => {
    mocks.productFindUniqueTx.mockResolvedValue({
      id: "product-1", storeId: "store-1", status: "DRAFT",
      store: { seller: { ownerId: "seller-1" } }
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
      store: { seller: { ownerId: "seller-1" } }
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
