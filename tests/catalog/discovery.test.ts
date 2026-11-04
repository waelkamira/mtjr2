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
      where: expect.objectContaining({ locale: "en", isActive: true }), take: 40
    }));
    const where = mocks.productFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
    expect(where.approvalStatus).toBe("APPROVED");
    expect(where.store).toEqual({ status: "ACTIVE", seller: { status: "ACTIVE" } });
    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].OR.length).toBeGreaterThan(8);
    expect(mocks.synonymFindMany.mock.calls[0][0].where.OR).toHaveLength(2);
  });

  it("requires every query token to match across product fields", async () => {
    await listDiscoverableProducts({ q: "red sneaker" });
    const where = mocks.productFindMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.objectContaining({ contains: "red" }) }),
      expect.objectContaining({ variants: expect.any(Object) })
    ]));
  });

  it("searches within the selected store and matches public seller names", async () => {
    await listDiscoverableProducts({ q: "northstar", storeId: "store-1" });
    const where = mocks.productFindMany.mock.calls[0][0].where;
    expect(where.store).toMatchObject({
      id: "store-1",
      status: "ACTIVE",
      seller: { status: "ACTIVE" }
    });
    expect(where.AND[0].OR).toContainEqual(expect.objectContaining({
      store: expect.objectContaining({
        is: expect.objectContaining({
          seller: expect.objectContaining({
            is: expect.objectContaining({
              displayName: { contains: "northstar", mode: "insensitive" }
            })
          })
        })
      })
    }));

  });

  it("requires a market when a currency filter is supplied", async () => {
    await expect(listDiscoverableProducts({ currencyCode: "EUR" })).rejects.toThrow();
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });

  it("matches the selected currency only when it is enabled in the active market", async () => {
    await listDiscoverableProducts({ marketId: "market-1", currencyCode: "EUR" });
    const where = mocks.productFindMany.mock.calls[0][0].where;
    expect(where.variants.some.prices.some).toMatchObject({
      marketId: "market-1",
      currencyCode: "EUR",
      market: {
        status: "ACTIVE",
        country: { isActive: true },
        currencies: { some: { isEnabled: true, currency: { isActive: true }, currencyCode: "EUR" } }
      }
    });
  });

  it("serializes BigInt product prices into JSON-safe minor-unit strings", async () => {
    mocks.productFindFirst.mockResolvedValue({
      id: "product-1",
      slug: "sample-product",
      translations: [{ name: "Localized product", description: "Localized description", seoTitle: "SEO title", seoDescription: "SEO description" }],
      name: "Sample product",
      description: null,
      publishedAt: new Date(),
      brand: { id: "brand-1", name: "Brand", slug: "brand", status: "ACTIVE", translations: [{ name: "Localized brand" }] },
      store: { id: "store-1", name: "Sample store", slug: "sample-store", markets: [{ marketId: "market-1" }] },
      media: [
        { url: "https://cdn.example.test/product.jpg", altText: "Product", isPrimary: true },
        { url: "http://cdn.example.test/unsafe.jpg", altText: "Unsafe", isPrimary: false }
      ],
      categories: [{ category: { id: "category-1", name: "Category", slug: "category", translations: [{ name: "Localized category" }] } }],
      attributes: [{
        attribute: { key: "material", valueType: "TEXT", translations: [{ name: "Material" }] },
        values: [{ value: "Cotton" }]
      }],
      variants: [{
        id: "variant-1",
        attributes: [{
          value: "Blue",
          attribute: { key: "color", valueType: "TEXT", translations: [{ name: "Color" }] }
        }],
        prices: [
          {
            marketId: "market-1", currencyCode: "EUR", amountMinor: BigInt(1299), compareAtMinor: BigInt(1599),
            currency: { minorUnit: 2 },
            market: { status: "ACTIVE", country: { isActive: true }, currencies: [{ currencyCode: "EUR" }] }
          },
          {
            marketId: "market-2", currencyCode: "USD", amountMinor: BigInt(1299), compareAtMinor: null,
            currency: { minorUnit: 2 },
            market: { status: "ACTIVE", country: { isActive: true }, currencies: [{ currencyCode: "USD" }] }
          }
        ]
      }]
    });
    const product = await getDiscoverableProduct("sample-product");
    expect(product?.variants[0].prices[0]).toMatchObject({
      marketId: "market-1",
      currencyCode: "EUR",
      amountMinor: "1299",
      compareAtMinor: "1599"
    });
    expect(product?.variants[0].prices).toHaveLength(1);
    expect(product?.media).toHaveLength(1);
    expect(product?.store).not.toHaveProperty("markets");
    expect(product).toMatchObject({
      name: "Localized product",
      seoTitle: "SEO title",
      seoDescription: "SEO description",
      brand: { name: "Localized brand" },
      categories: [{ name: "Localized category" }],
      attributes: [{ name: "Material", values: ["Cotton"] }],
      variants: [{ attributes: [{ name: "Color", value: "Blue" }] }]
    });
  });

  it("does not expose missing or non-public products through slug lookup", async () => {
    expect(await getDiscoverableProduct("hidden-draft")).toBeNull();
    expect(mocks.productFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ slug: "hidden-draft" }, { id: "hidden-draft" }],
        status: "ACTIVE",
        approvalStatus: "APPROVED"
      })
    }));
  });
});
