import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
  categoryFindFirst: vi.fn(),
  productCategoryFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    category: { findMany: mocks.categoryFindMany, findFirst: mocks.categoryFindFirst },
    productCategory: { findMany: mocks.productCategoryFindMany }
  }
}));

import { buildCategoryTree, getActiveCategoryBySlug, listActiveCategoryTree } from "@/server/catalog/taxonomy";

const row = (id: string, parentId: string | null, sortOrder = 0) => ({
  id, parentId, slug: id, name: id, description: null, imageUrl: null, sortOrder, translations: []
});

describe("buildCategoryTree", () => {
  it("builds and sorts a bounded flat result into a hierarchy", () => {
    const tree = buildCategoryTree([
      row("child-b", "root", 2), row("root", null), row("child-a", "root", 1)
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((item) => item.id)).toEqual(["child-a", "child-b"]);
  });

  it("omits cyclic and orphan edges without recursing forever", () => {
    const tree = buildCategoryTree([
      row("a", "b"), row("b", "a"), row("orphan", "missing")
    ]);
    expect(tree).toEqual([]);
  });

  it("uses the requested locale translation when present", () => {
    const translated = { ...row("root", null), translations: [{ name: "Maison", description: "French" }] };
    expect(buildCategoryTree([translated])[0]).toMatchObject({ name: "Maison", description: "French" });
  });
});

describe("listActiveCategoryTree pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productCategoryFindMany.mockResolvedValue([]);
  });

  it("filters empty categories and loads every descendant before building the tree", async () => {
    mocks.categoryFindMany
      .mockResolvedValueOnce([row("root", null)])
      .mockResolvedValueOnce([row("child", "root")])
      .mockResolvedValueOnce([row("grandchild", "child")])
      .mockResolvedValueOnce([]);
    mocks.productCategoryFindMany.mockResolvedValue([
      { categoryId: "root" },
      { categoryId: "child" },
      { categoryId: "grandchild" }
    ]);

    const result = await listActiveCategoryTree({ page: 1, limit: 1, locale: "en" });

    expect(result.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("root");
    expect(result.items[0].children[0].id).toBe("child");
    expect(result.items[0].children[0].children[0].id).toBe("grandchild");
    expect(mocks.categoryFindMany.mock.calls[0][0].where).toMatchObject({ parentId: null });
    expect(mocks.categoryFindMany.mock.calls[0][0]).not.toHaveProperty("skip");
    expect(mocks.categoryFindMany.mock.calls[1][0].where.parentId).toEqual({ in: ["root"] });
    expect(mocks.categoryFindMany.mock.calls[2][0].where.parentId).toEqual({ in: ["child"] });
    expect(mocks.productCategoryFindMany.mock.calls[0][0].where.product).toMatchObject({
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      store: { status: "ACTIVE", seller: { status: "ACTIVE" } },
      variants: { some: { isActive: true } }
    });
  });

  it("omits an empty parent while keeping its populated child and paginating nonempty roots", async () => {
    mocks.categoryFindMany
      .mockResolvedValueOnce([row("empty-root", null), row("populated-root", null)])
      .mockResolvedValueOnce([row("populated-child", "empty-root")])
      .mockResolvedValueOnce([]);
    mocks.productCategoryFindMany.mockResolvedValue([{ categoryId: "populated-child" }]);

    const result = await listActiveCategoryTree({ page: 1, limit: 1 });

    expect(result.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(result.items.map((item) => item.id)).toEqual(["populated-child"]);
    expect(result.items[0].children).toEqual([]);
  });

  it("returns no categories when none have published active products", async () => {
    mocks.categoryFindMany.mockResolvedValue([row("empty", null)]);

    const result = await listActiveCategoryTree();

    expect(result.items).toEqual([]);
    expect(result.pagination).toMatchObject({ total: 0, totalPages: 0 });
  });

  it("stops traversing when a malformed cycle points back to an already visited node", async () => {
    mocks.categoryFindMany
      .mockResolvedValueOnce([row("root", null)])
      .mockResolvedValueOnce([row("root", null)])
      .mockResolvedValueOnce([]);
    mocks.productCategoryFindMany.mockResolvedValue([{ categoryId: "root" }]);

    const result = await listActiveCategoryTree();
    expect(result.items.map((item) => item.id)).toEqual(["root"]);
    expect(mocks.categoryFindMany).toHaveBeenCalledTimes(2);
  });
});

describe("getActiveCategoryBySlug", () => {
  it("only resolves active categories that have a public product with an active variant", async () => {
    mocks.categoryFindFirst.mockResolvedValue(null);

    await expect(getActiveCategoryBySlug("empty-category")).resolves.toBeNull();
    expect(mocks.categoryFindFirst.mock.calls[0][0].where).toMatchObject({
      slug: "empty-category",
      status: "ACTIVE",
      productLinks: {
        some: {
          product: {
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            store: { status: "ACTIVE", seller: { status: "ACTIVE" } },
            variants: { some: { isActive: true } }
          }
        }
      }
    });
  });
});
