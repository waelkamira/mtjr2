import { describe, expect, it } from "vitest";
import { buildCategoryTree, type CategoryTreeRow } from "../../src/server/catalog/category-tree";

const row = (id: string, parentId: string | null, overrides: Partial<CategoryTreeRow> = {}): CategoryTreeRow => ({
  id,
  parentId,
  slug: id,
  name: id,
  description: null,
  sortOrder: 0,
  ...overrides
});

describe("buildCategoryTree", () => {
  it("builds a localized hierarchy and keeps the requested order", () => {
    const tree = buildCategoryTree([
      row("root", null, { sortOrder: 1 }),
      row("child", "root", { translation: { name: "Child localized", description: null } }),
      row("second-root", null, { sortOrder: 2 })
    ]);

    expect(tree.map((item) => item.id)).toEqual(["root", "second-root"]);
    expect(tree[0].children[0].name).toBe("Child localized");
  });

  it("omits cyclic and orphaned branches", () => {
    const tree = buildCategoryTree([
      row("cycle-a", "cycle-b"),
      row("cycle-b", "cycle-a"),
      row("orphan", "missing"),
      row("valid", null)
    ]);

    expect(tree.map((item) => item.id)).toEqual(["valid"]);
  });

  it("enforces a bounded maximum depth", () => {
    const tree = buildCategoryTree([
      row("level-1", null),
      row("level-2", "level-1"),
      row("level-3", "level-2")
    ], 2);

    expect(tree.map((item) => item.id)).toEqual(["level-1"]);
    expect(tree[0].children.map((item) => item.id)).toEqual(["level-2"]);
  });

  it("rejects unsafe depth configuration", () => {
    expect(() => buildCategoryTree([], 99)).toThrow();
  });
});
