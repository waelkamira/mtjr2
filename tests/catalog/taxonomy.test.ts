import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
  categoryCount: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { category: { findMany: mocks.categoryFindMany, count: mocks.categoryCount } }
}));

import { buildCategoryTree, listActiveCategoryTree } from "@/server/catalog/taxonomy";

const row = (id: string, parentId: string | null, sortOrder = 0) => ({
  id, parentId, slug: id, name: id, description: null, imageUrl: null, sortOrder, translations: []
});

describe("buildCategoryTree", () => {
  it("builds and sorts a bounded flat result into a hierarchy", () => {
    const tree = buildCategoryTree([
      row("child-b", "root", 2), row("root", null), row("child-a", "root", 1)
    ], "en");
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((item) => item.id)).toEqual(["child-a", "child-b"]);
  });

  it("breaks cyclic and orphan edges without recursing forever", () => {
    const tree = buildCategoryTree([
      row("a", "b"), row("b", "a"), row("orphan", "missing")
    ], "en");
    expect(tree.map((item) => item.id).sort()).toEqual(["a", "b", "orphan"]);
  });

  it("uses the requested locale translation when present", () => {
    const translated = { ...row("root", null), translations: [{ name: "Maison", description: "French" }] };
    expect(buildCategoryTree([translated], "fr")[0]).toMatchObject({ name: "Maison", description: "French" });
  });
});

describe("listActiveCategoryTree pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.categoryCount.mockResolvedValue(1);
  });

  it("paginates root categories and loads every descendant before building the tree", async () => {
    mocks.categoryFindMany
      .mockResolvedValueOnce([row("root", null)])
      .mockResolvedValueOnce([row("child", "root")])
      .mockResolvedValueOnce([row("grandchild", "child")])
      .mockResolvedValueOnce([]);

    const result = await listActiveCategoryTree({ page: 1, limit: 1, locale: "en" });

    expect(result.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("root");
    expect(result.items[0].children[0].id).toBe("child");
    expect(result.items[0].children[0].children[0].id).toBe("grandchild");
    expect(mocks.categoryFindMany.mock.calls[0][0].where).toMatchObject({ parentId: null });
    expect(mocks.categoryFindMany.mock.calls[1][0].where.parentId).toEqual({ in: ["root"] });
    expect(mocks.categoryFindMany.mock.calls[2][0].where.parentId).toEqual({ in: ["child"] });
  });

  it("stops traversing when a malformed cycle points back to an already visited node", async () => {
    mocks.categoryFindMany
      .mockResolvedValueOnce([row("root", null)])
      .mockResolvedValueOnce([row("root", null)])
      .mockResolvedValueOnce([]);

    const result = await listActiveCategoryTree();
    expect(result.items.map((item) => item.id)).toEqual(["root"]);
    expect(mocks.categoryFindMany).toHaveBeenCalledTimes(2);
  });
});
