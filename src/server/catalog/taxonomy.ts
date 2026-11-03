import "server-only";

import { CatalogEntityStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const listSchema = z.object({
  locale: z.string().trim().min(2).max(16).default("en"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export type CategoryTreeNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
};

type CategoryRow = {
  id: string; parentId: string | null; slug: string; name: string;
  description: string | null; imageUrl: string | null; sortOrder: number;
  translations: Array<{ name: string; description: string | null }>;
};

export function buildCategoryTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const row of rows) {
    const translation = row.translations.find((item) => item.name.trim().length > 0);
    nodes.set(row.id, {
      id: row.id, parentId: row.parentId, slug: row.slug,
      name: translation?.name ?? row.name,
      description: translation?.description ?? row.description,
      imageUrl: row.imageUrl, sortOrder: row.sortOrder, children: []
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    if (!node.parentId || !nodes.has(node.parentId) || node.parentId === node.id) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parentId)!;
    // Reject cyclic edges rather than allowing recursion or dropping the entire branch.
    let ancestor: CategoryTreeNode | undefined = parent;
    const seen = new Set<string>([node.id]);
    let cyclic = false;
    while (ancestor) {
      if (seen.has(ancestor.id)) { cyclic = true; break; }
      seen.add(ancestor.id);
      ancestor = ancestor.parentId ? nodes.get(ancestor.parentId) : undefined;
    }
    if (cyclic) roots.push(node);
    else parent.children.push(node);
  }

  const sort = (items: CategoryTreeNode[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    for (const item of items) sort(item.children);
  };
  sort(roots);
  return roots;
}

/** Public category tree; only active categories and translations are exposed. */
export async function listActiveCategoryTree(input: unknown = {}) {
  const query = listSchema.parse(input);
  const where: Prisma.CategoryWhereInput = { status: CatalogEntityStatus.ACTIVE };
  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true, parentId: true, slug: true, name: true, description: true,
        imageUrl: true, sortOrder: true,
        translations: { where: { locale: query.locale }, select: { name: true, description: true }, take: 1 }
      }
    }),
    prisma.category.count({ where })
  ]);
  return {
    items: buildCategoryTree(rows),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}

/** Public active brand directory with locale fallback and stable pagination. */
export async function listActiveBrands(input: unknown = {}) {
  const query = listSchema.parse(input);
  const where: Prisma.BrandWhereInput = { status: CatalogEntityStatus.ACTIVE };
  const [items, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
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
      logoUrl: brand.logoUrl, websiteUrl: brand.websiteUrl
    })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
  };
}
