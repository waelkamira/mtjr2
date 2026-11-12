import { describe, expect, it } from "vitest";
import { createProductSlug } from "@/lib/product-slug";

describe("createProductSlug", () => {
  it("creates ASCII slugs from Arabic product names", () => {
    expect(createProductSlug("هاتف سامسونج جالاكسي S24")).toBe("hatf-samswng-jalaks-y-s24");
  });

  it("preserves Latin names and normalizes punctuation", () => {
    expect(createProductSlug("Apple iPhone 16 Pro!!!")).toBe("apple-iphone-16-pro");
  });

  it("handles Arabic-Indic digits", () => {
    expect(createProductSlug("هاتف ١٢٨ جيجابايت")).toBe("hatf-128-jyjabayt");
  });

  it("returns a safe fallback when the name has no slug characters", () => {
    expect(createProductSlug("📱")).toBe("product");
  });

  it("limits the slug to 180 characters", () => {
    expect(createProductSlug("a".repeat(220))).toHaveLength(180);
  });
});
