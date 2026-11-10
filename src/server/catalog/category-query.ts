import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  buildCategoryTree,
  type CategoryTreeNode,
  type CategoryTreeRow
} from "@/server/catalog/category-tree";

const localeSchema = z.string().trim().min(2).max(16).regex(/^[a-zA-Z0-9-]+$/);

export async function getActiveCategoryTree(
  requestedLocale: string,
  maxDepth = 6
): Promise<CategoryTreeNode[]> {
  const locale = localeSchema.parse(requestedLocale);

  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    throw new Error("Category tree depth must be between 1 and 10.");
  }

  const rows = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      parentId: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
      translations: {
        where: { locale },
        select: { name: true, description: true },
        take: 1
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 500
  });

  const treeRows: CategoryTreeRow[] = rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    translation: row.translations[0] ?? null
  }));

  return buildCategoryTree(treeRows, maxDepth);
}
