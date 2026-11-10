import "server-only";

import { CatalogEntityStatus, ProductApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

const visibleProduct = {
  status: CatalogEntityStatus.ACTIVE,
  approvalStatus: ProductApprovalStatus.APPROVED,
  store: { status: "ACTIVE" as const, seller: { status: "ACTIVE" as const } }
};

export async function listMyRecommendations(limit = 12) {
  const actor = await requireCurrentSession();
  const favorites = await prisma.favorite.findMany({
    where: { userId: actor.userId, product: visibleProduct },
    select: { productId: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  const favoriteIds = favorites.map((item) => item.productId);
  if (!favoriteIds.length) return { items: [], reason: "SAVE_PRODUCTS_TO_PERSONALIZE" as const };

  const curated = await prisma.recommendation.findMany({
    where: {
      isActive: true,
      sourceProductId: { in: favoriteIds },
      recommendedProductId: { notIn: favoriteIds },
      recommendedProduct: visibleProduct
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: limit * 2,
    select: { recommendedProductId: true, score: true, reason: true }
  });
  const curatedIds = [...new Set(curated.map((item) => item.recommendedProductId))];
  const missing = Math.max(0, limit - curatedIds.length);
  let fallbackIds: string[] = [];
  if (missing) {
    const categoryLinks = await prisma.productCategory.findMany({
      where: { productId: { in: favoriteIds }, category: { status: CatalogEntityStatus.ACTIVE } },
      select: { categoryId: true },
      take: 300
    });
    const categoryIds = [...new Set(categoryLinks.map((item) => item.categoryId))];
    if (categoryIds.length) {
      const candidates = await prisma.product.findMany({
        where: {
          ...visibleProduct,
          id: { notIn: [...favoriteIds, ...curatedIds] },
          categories: { some: { categoryId: { in: categoryIds }, category: { status: CatalogEntityStatus.ACTIVE } } }
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        take: missing * 3,
        select: { id: true }
      });
      fallbackIds = candidates.map((item) => item.id).slice(0, missing);
    }
  }
  const ids = [...curatedIds, ...fallbackIds].slice(0, limit);
  if (!ids.length) return { items: [], reason: "NO_RELEVANT_PRODUCTS" as const };
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, ...visibleProduct },
    select: {
      id: true, slug: true, name: true,
      media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, altText: true } },
      store: { select: { name: true, slug: true } }
    }
  });
  const byId = new Map(products.map((item) => [item.id, item]));
  const curatedById = new Map(curated.map((item) => [item.recommendedProductId, item]));
  return {
    items: ids.flatMap((id) => {
      const item = byId.get(id);
      if (!item) return [];
      const recommendation = curatedById.get(id);
      return [{
        ...item,
        image: item.media[0] ?? null,
        reason: recommendation?.reason ?? "SIMILAR_CATEGORY"
      }];
    })
  };
}
