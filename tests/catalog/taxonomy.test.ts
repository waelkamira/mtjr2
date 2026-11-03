import { describe, expect, it } from "vitest";
import { buildCategoryTree } from "@/server/catalog/taxonomy";

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
