import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  productCount: vi.fn(),
  productFindFirst: vi.fn(),
  synonymFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    product: { findMany: mocks.productFindMany, count: mocks.productCount, findFirst: mocks.productFindFirst },
    searchSynonym: { findMany: mocks.synonymFindMany }
  }
}));

import { getDiscoverableProduct, listDiscoverableProducts } from "@/server/catalog/discovery";

describe("public product discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindMany.mockResolvedValue([]);
    mocks.productCount.mockResolvedValue(0);
    mocks.productFindFirst.mockResolvedValue(null);
    mocks.synonymFindMany.mockResolvedValue([{ term: "sneaker", synonym: "trainer" }]);
  });

  it("uses active localized synonyms and bounded pagination", async () => {
    const result = await listDiscoverableProducts({ q: "sneaker", locale: "en", page: "2", limit: "12" });
    expect(result.pagination).toEqual({ page: 2, limit: 12, total: 0, totalPages: 0 });
    expect(mocks.synonymFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ locale: "en", isActive: true }), take: 30
    }));
    const where = mocks.productFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
    expect(where.store).toEqual({ status: "ACTIVE", seller: { status: "ACTIVE" } });
    expect(where.OR.length).toBeGreaterThan(4);
  });

  it("requires a market when a currency filter is supplied", async () => {
    await expect(listDiscoverableProducts({ currencyCode: "EUR" })).rejects.toThrow();
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });

  it("serializes BigInt product prices into JSON-safe minor-unit strings", async () => {
    mocks.productFindFirst.mockResolvedValue({
      translations: [],
      name: "Sample product",
      description: null,
      variants: [{ prices: [{ amountMinor: 1299n, compareAtMinor: 1599n }] }]
    });
    const product = await getDiscoverableProduct("sample-product");
    expect(product?.variants[0].prices[0]).toMatchObject({
      amountMinor: "1299",
      compareAtMinor: "1599"
    });
  });

  it("does not expose missing or non-public products through slug lookup", async () => {
    expect(await getDiscoverableProduct("hidden-draft")).toBeNull();
    expect(mocks.productFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: "hidden-draft", status: "ACTIVE" })
    }));
  });
});
