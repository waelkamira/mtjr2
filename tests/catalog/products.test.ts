import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  brandFindFirst: vi.fn(),
  categoryCount: vi.fn(),
  marketFindMany: vi.fn(),
  productCreate: vi.fn(),
  productFindUnique: vi.fn(),
  productUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission: mocks.userHasScopedPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { product: { findUnique: mocks.productFindUnique }, $transaction: mocks.transaction }
}));

import { createDraftProduct, publishProduct } from "@/server/catalog/products";

describe("product lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE" },
      markets: [{ marketId: "market-1" }]
    });
    mocks.brandFindFirst.mockResolvedValue({ id: "brand-1" });
    mocks.categoryCount.mockResolvedValue(1);
    mocks.marketFindMany.mockResolvedValue([{ id: "market-1", currencies: [{ currencyCode: "EUR" }] }]);
    mocks.productCreate.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    mocks.productFindUnique.mockResolvedValue({ storeId: "store-1", store: { seller: { ownerId: "seller-1" } } });
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      store: { findUnique: mocks.storeFindUnique },
      brand: { findFirst: mocks.brandFindFirst },
      category: { count: mocks.categoryCount },
      market: { findMany: mocks.marketFindMany },
      product: {
        create: mocks.productCreate,
        findUnique: vi.fn().mockResolvedValue({
          id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "APPROVED",
          store: {
            status: "ACTIVE", seller: { status: "ACTIVE" },
            markets: [{ marketId: "market-1", market: { currencies: [{ currencyCode: "EUR" }] } }]
          },
          variants: [{ id: "variant-1", prices: [{ marketId: "market-1", currencyCode: "EUR" }] }],
          media: [{ id: "media-1" }]
        }),
        updateMany: mocks.productUpdateMany
      },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("creates variants and minor-unit prices atomically in the store's enabled market", async () => {
    const result = await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"], brandId: "brand-1",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(result).toMatchObject({ id: "product-1", status: "DRAFT", approvalStatus: "PENDING" });
    const createArg = mocks.productCreate.mock.calls[0][0];
    expect(createArg.data.variants.create[0].prices.create[0].amountMinor).toBe(2499n);
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects a price targeting a market not enabled for the store", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE" }, markets: []
    });
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/enabled for this store/i);
    expect(mocks.productCreate).not.toHaveBeenCalled();
  });

  it("publishes only with the exact store-scoped catalog permission", async () => {
    const result = await publishProduct("product-1");
    expect(result).toMatchObject({ productId: "product-1", status: "ACTIVE" });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.objectContaining({
      permissionKey: "catalog:manage", scope: { type: "STORE", id: "store-1" }
    }));
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

});
