import { describe, expect, it } from "vitest";
import { tokenizeSearchQuery } from "@/server/search/query";
describe("tokenizeSearchQuery", () => {
  it("normalizes Unicode, punctuation and duplicate terms", () => { expect(tokenizeSearchQuery(" Café, CAFÉ — shoes! ")).toEqual(["café", "shoes"]); });
  it("bounds token count and preserves short words and numeric identifiers", () => {
    expect(tokenizeSearchQuery("a b c 123456789 1 2 3 4 5 6 7 8 9")).toHaveLength(8);
    expect(tokenizeSearchQuery("a b")).toEqual(["a", "b"]);
  });
});
