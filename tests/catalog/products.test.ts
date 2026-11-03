import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const { requirePermission, storeFindUnique, brandFindFirst, categoryCount, marketFindMany, productCreate, auditCreate, transaction } = vi.hoisted(() => ({
  requirePermission: vi.fn(), storeFindUnique: vi.fn(), brandFindFirst: vi.fn(),
  categoryCount: vi.fn(), marketFindMany: vi.fn(), productCreate: vi.fn(),
  auditCreate: vi.fn(), transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: transaction } }));

import { createDraftProduct } from "@/server/catalog/products";

describe("draft product creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue({ userId: "seller-1" });
    storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE" },
      markets: [{ marketId: "market-1" }]
    });
    brandFindFirst.mockResolvedValue({ id: "brand-1" });
    categoryCount.mockResolvedValue(1);
    marketFindMany.mockResolvedValue([{ id: "market-1", currencies: [{ currencyCode: "EUR" }] }]);
    productCreate.mockResolvedValue({ id: "product-1", storeId: "store-1", status: "DRAFT", approvalStatus: "PENDING" });
    auditCreate.mockResolvedValue({});
    transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      store: { findUnique: storeFindUnique },
      brand: { findFirst: brandFindFirst },
      category: { count: categoryCount },
      market: { findMany: marketFindMany },
      product: { create: productCreate },
      auditLog: { create: auditCreate }
    }));
  });

  it("creates variants and prices in the store's enabled market atomically", async () => {
    const result = await createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      categoryIds: ["category-1"], brandId: "brand-1",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    });
    expect(result).toMatchObject({ id: "product-1", status: "DRAFT", approvalStatus: "PENDING" });
    const createArg = productCreate.mock.calls[0][0];
    expect(createArg.data.variants.create[0].prices.create[0].amountMinor).toBe(2499n);
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects a price targeting a market not enabled for the store", async () => {
    marketFindMany.mockResolvedValue([{ id: "market-1", currencies: [{ currencyCode: "EUR" }] }]);
    storeFindUnique.mockResolvedValue({
      id: "store-1", status: "ACTIVE", seller: { status: "ACTIVE" }, markets: []
    });
    await expect(createDraftProduct({
      storeId: "store-1", name: "Travel Mug", slug: "travel-mug",
      variants: [{ sku: "MUG-BLK", prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: "2499" }] }]
    })).rejects.toThrow(/enabled for this store/i);
    expect(productCreate).not.toHaveBeenCalled();
  });
});
