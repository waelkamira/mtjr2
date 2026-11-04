export interface CategoryTreeRow {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  translation?: {
    name: string;
    description: string | null;
  } | null;
}

export interface CategoryTreeNode {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
}

/**
 * Builds a bounded tree from already-filtered category rows.
 * Orphans, cycles, and branches deeper than maxDepth fail closed and are omitted.
 */
export function buildCategoryTree(
  rows: readonly CategoryTreeRow[],
  maxDepth = 6
): CategoryTreeNode[] {
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    throw new Error("Category tree depth must be between 1 and 10.");
  }

  const byId = new Map<string, CategoryTreeRow>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  const valid = new Set<string>();

  for (const row of byId.values()) {
    let current: CategoryTreeRow | undefined = row;
    const visited = new Set<string>();
    let depth = 0;
    let safe = true;

    while (current) {
      if (visited.has(current.id)) {
        safe = false;
        break;
      }
      visited.add(current.id);
      depth += 1;

      if (depth > maxDepth) {
        safe = false;
        break;
      }

      if (!current.parentId) break;
      current = byId.get(current.parentId);
      if (!current) {
        safe = false;
        break;
      }
    }

    if (safe) {
      valid.add(row.id);
    }
  }

  const nodes = new Map<string, CategoryTreeNode>();
  for (const row of byId.values()) {
    if (!valid.has(row.id)) continue;
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parentId,
      slug: row.slug,
      name: row.translation?.name ?? row.name,
      description: row.translation?.description ?? row.description,
      imageUrl: row.imageUrl ?? null,
      sortOrder: row.sortOrder,
      children: []
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const row of byId.values()) {
    const node = nodes.get(row.id);
    if (!node) continue;

    if (!row.parentId) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(row.parentId);
    if (parent) parent.children.push(node);
  }

  const sortNodes = (items: CategoryTreeNode[]) => {
    items.sort((left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    );
    for (const item of items) sortNodes(item.children);
  };
  sortNodes(roots);

  return roots;
}
