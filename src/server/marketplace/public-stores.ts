import "server-only";

import { CatalogEntityStatus, StoreStatus, SellerStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export async function listDiscoverableStores(input: unknown = {}) {
  const query = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    q: z.string().trim().max(120).optional()
  }).strict().parse(input);
  const where = {
    status: StoreStatus.ACTIVE,
    seller: { status: SellerStatus.ACTIVE },
    products: { some: { status: CatalogEntityStatus.ACTIVE } },
    ...(query.q ? { OR: [
      { name: { contains: query.q, mode: "insensitive" as const } },
      { slug: { contains: query.q, mode: "insensitive" as const } },
      { seller: { displayName: { contains: query.q, mode: "insensitive" as const } } }
    ] } : {})
  };
  const [items, total] = await Promise.all([
    prisma.store.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: {
        id: true, slug: true, name: true,
        seller: { select: { displayName: true } },
        _count: { select: { products: { where: { status: CatalogEntityStatus.ACTIVE } } } }
      }
    }),
    prisma.store.count({ where })
  ]);
  return {
    items: items.map(({ _count, seller, ...store }) => ({
      ...store, sellerDisplayName: seller.displayName, productCount: _count.products
    })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}

export async function getDiscoverableStoreBySlug(slug: string) {
  const key = z.string().trim().min(1).max(160).parse(slug);
  const store = await prisma.store.findFirst({
    where: { slug: key, status: StoreStatus.ACTIVE, seller: { status: SellerStatus.ACTIVE } },
    select: {
      id: true, slug: true, name: true, createdAt: true,
      seller: { select: { displayName: true } },
      _count: { select: { products: { where: { status: CatalogEntityStatus.ACTIVE } } } }
    }
  });
  return store ? {
    id: store.id, slug: store.slug, name: store.name,
    sellerDisplayName: store.seller.displayName,
    productCount: store._count.products, createdAt: store.createdAt
  } : null;
}
