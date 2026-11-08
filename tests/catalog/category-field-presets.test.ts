import { describe, expect, it } from "vitest";
import { getCategoryFieldPresets } from "@/lib/catalog/category-field-presets";

describe("Akaar-compatible category field presets", () => {
  it("provides all required real-estate and vehicle listing details", () => {
    expect(getCategoryFieldPresets("real-estate").map((field) => field.key)).toEqual([
      "adType", "rooms", "livingrooms", "area", "propertyType", "bathrooms"
    ]);
    expect(getCategoryFieldPresets("cars").map((field) => field.key)).toContain("mileage");
  });

  it("resolves supported category slug aliases", () => {
    expect(getCategoryFieldPresets("mobile-phones").map((field) => field.key)).toContain("storage");
    expect(getCategoryFieldPresets("baby-products").map((field) => field.key)).toContain("safetyCertification");
  });

  it("returns fresh, empty values for every preset field", () => {
    const fields = getCategoryFieldPresets("computers");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((field) => field.value === "")).toBe(true);
    expect(fields.every((field) => field.label.length > 0)).toBe(true);
  });

  it("returns no presets for unknown categories without blocking custom fields", () => {
    expect(getCategoryFieldPresets("unknown-category")).toEqual([]);
  });
});
