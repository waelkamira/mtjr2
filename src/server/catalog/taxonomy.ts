import "server-only";

import { CatalogEntityStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { buildCategoryTree as buildBoundedCategoryTree, type CategoryTreeNode, type CategoryTreeRow } from "@/server/catalog/category-tree";
import { isSafeCatalogMediaUrl } from "@/server/catalog/media-url";

const listSchema = z.object({
  locale: z.string().trim().min(2).max(16).default("en"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

type CategoryRow = {
  id: string; parentId: string | null; slug: string; name: string;
  description: string | null; imageUrl: string | null; sortOrder: number;
  translations: Array<{ name: string; description: string | null }>;
};

export function buildCategoryTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const treeRows: CategoryTreeRow[] = rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: isSafeCatalogMediaUrl(row.imageUrl ?? "") ? row.imageUrl : null,
    sortOrder: row.sortOrder,
    translation: row.translations.find((item) => item.name.trim().length > 0) ?? null
  }));
  return buildBoundedCategoryTree(treeRows, 6);
}

export async function listActiveCategoryTree(input: unknown = {}) {
  const query = listSchema.parse(input);
  const where: Prisma.CategoryWhereInput = { status: CatalogEntityStatus.ACTIVE, parentId: null };
  const select = {
    id: true, parentId: true, slug: true, name: true, description: true,
    imageUrl: true, sortOrder: true,
    translations: { where: { locale: query.locale }, select: { name: true, description: true }, take: 1 }
  } as const;

  // Paginate only root categories. Fetch descendants separately so a page boundary
  // can never detach a child from its parent in the public category tree.
  const [roots, total] = await Promise.all([
    prisma.category.findMany({
      where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit, take: query.limit, select
    }),
    prisma.category.count({ where })
  ]);

  const rows: CategoryRow[] = [...roots];
  const visited = new Set(roots.map((item) => item.id));
  let frontier = roots.map((item) => item.id);
  let depth = 1;
  while (frontier.length > 0 && depth < 6) {
    const children = await prisma.category.findMany({
      where: { status: CatalogEntityStatus.ACTIVE, parentId: { in: frontier } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      select
    });
    const next = children.filter((item) => !visited.has(item.id));
    for (const child of next) {
      visited.add(child.id);
      rows.push(child);
    }
    frontier = next.map((item) => item.id);
    depth += 1;
  }

  return {
    items: buildCategoryTree(rows),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}
export async function listActiveBrands(input: unknown = {}) {
  const query = listSchema.parse(input);
  const where: Prisma.BrandWhereInput = { status: CatalogEntityStatus.ACTIVE };
  const [items, total] = await Promise.all([
    prisma.brand.findMany({
      where, orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: {
        id: true, slug: true, name: true, description: true, logoUrl: true, websiteUrl: true,
        translations: { where: { locale: query.locale }, select: { name: true, description: true }, take: 1 }
      }
    }),
    prisma.brand.count({ where })
  ]);
  return {
    items: items.map((brand) => ({
      id: brand.id, slug: brand.slug,
      name: brand.translations[0]?.name ?? brand.name,
      description: brand.translations[0]?.description ?? brand.description,
      logoUrl: isSafeCatalogMediaUrl(brand.logoUrl ?? "") ? brand.logoUrl : null,
      websiteUrl: brand.websiteUrl
    })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}

export async function getActiveCategoryBySlug(slug: string, locale = "en") {
  const key = z.string().trim().min(1).max(180).parse(slug);
  const language = z.string().trim().min(2).max(16).parse(locale);
  const item = await prisma.category.findFirst({
    where: { slug: key, status: CatalogEntityStatus.ACTIVE },
    select: {
      id: true, slug: true, name: true, description: true, imageUrl: true,
      translations: { where: { locale: language }, select: { name: true, description: true, seoTitle: true, seoDescription: true }, take: 1 }
    }
  });
  return item ? {
    id: item.id, slug: item.slug,
    name: item.translations[0]?.name ?? item.name,
    description: item.translations[0]?.description ?? item.description,
    seoTitle: item.translations[0]?.seoTitle ?? item.translations[0]?.name ?? item.name,
    seoDescription: item.translations[0]?.seoDescription ?? item.translations[0]?.description ?? item.description,
    imageUrl: isSafeCatalogMediaUrl(item.imageUrl ?? "") ? item.imageUrl : null
  } : null;
}

export async function getActiveBrandBySlug(slug: string, locale = "en") {
  const key = z.string().trim().min(1).max(180).parse(slug);
  const language = z.string().trim().min(2).max(16).parse(locale);
  const item = await prisma.brand.findFirst({
    where: { slug: key, status: CatalogEntityStatus.ACTIVE },
    select: {
      id: true, slug: true, name: true, description: true, logoUrl: true, websiteUrl: true,
      translations: { where: { locale: language }, select: { name: true, description: true, seoTitle: true, seoDescription: true }, take: 1 }
    }
  });
  return item ? {
    id: item.id, slug: item.slug,
    name: item.translations[0]?.name ?? item.name,
    description: item.translations[0]?.description ?? item.description,
    seoTitle: item.translations[0]?.seoTitle ?? item.translations[0]?.name ?? item.name,
    seoDescription: item.translations[0]?.seoDescription ?? item.translations[0]?.description ?? item.description,
    logoUrl: isSafeCatalogMediaUrl(item.logoUrl ?? "") ? item.logoUrl : null,
    websiteUrl: item.websiteUrl
  } : null;
}
