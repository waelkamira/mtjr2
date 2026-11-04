import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  productFindMany: vi.fn(),
  productCategoryFindMany: vi.fn(),
  favoriteFindMany: vi.fn(),
  favoriteCreateMany: vi.fn(),
  recommendationFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    product: { findMany: mocks.productFindMany },
    productCategory: { findMany: mocks.productCategoryFindMany },
    favorite: { findMany: mocks.favoriteFindMany, createMany: mocks.favoriteCreateMany },
    recommendation: { findMany: mocks.recommendationFindMany }
  }
}));

import { mergeGuestFavorites } from "@/server/wishlist/favorites";
import { listMyRecommendations } from "@/server/wishlist/recommendations";

describe("wishlist guest merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "user-1" });
    mocks.productFindMany.mockResolvedValue([{ id: "p-1" }, { id: "p-2" }]);
    mocks.favoriteCreateMany.mockResolvedValue({ count: 1 });
  });

  it("deduplicates guest IDs, filters unavailable products and uses skipDuplicates", async () => {
    const result = await mergeGuestFavorites(["p-1", "p-1", "p-2", "missing"]);
    expect(mocks.productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["p-1", "p-2", "missing"] },
        status: "ACTIVE",
        approvalStatus: "APPROVED"
      })
    }));
    expect(mocks.favoriteCreateMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", productId: "p-1" }, { userId: "user-1", productId: "p-2" }],
      skipDuplicates: true
    });
    expect(result).toEqual({ merged: 1, ignored: 2 });
  });

  it("does not query for an empty guest wishlist", async () => {
    expect(await mergeGuestFavorites([])).toEqual({ merged: 0, ignored: 0 });
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });
});

describe("privacy-safe recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "user-1" });
    mocks.favoriteFindMany.mockResolvedValue([{ productId: "saved-1" }]);
    mocks.recommendationFindMany.mockResolvedValue([]);
    mocks.productCategoryFindMany.mockResolvedValue([{ categoryId: "cat-1" }]);
    mocks.productFindMany.mockResolvedValue([
      { id: "rec-1", slug: "similar", name: "Similar", media: [], store: { name: "Store", slug: "store" } }
    ]);
  });

  it("only recommends public products related to the signed-in user's own favorites", async () => {
    const result = await listMyRecommendations();
    expect(mocks.favoriteFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-1" }),
      take: 100
    }));
    expect(mocks.productFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        id: { notIn: ["saved-1"] },
        categories: expect.objectContaining({ some: expect.objectContaining({ categoryId: { in: ["cat-1"] } }) })
      })
    }));
    expect(result.items[0]).toMatchObject({ id: "rec-1", reason: "SIMILAR_CATEGORY" });
  });

  it("does not infer preferences or return recommendations without saved products", async () => {
    mocks.favoriteFindMany.mockResolvedValue([]);
    expect(await listMyRecommendations()).toEqual({ items: [], reason: "SAVE_PRODUCTS_TO_PERSONALIZE" });
    expect(mocks.recommendationFindMany).not.toHaveBeenCalled();
    expect(mocks.productCategoryFindMany).not.toHaveBeenCalled();
  });
});
