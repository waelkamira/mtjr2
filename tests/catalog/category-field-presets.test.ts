import { describe, expect, it } from "vitest";
import { buildCategoryFieldsForEdit, getCategoryFieldPresets, mergeEditedCategoryFields } from "@/lib/catalog/category-field-presets";

describe("Akaar-compatible category field presets", () => {
  it("provides all required real-estate and vehicle listing details", () => {
    expect(getCategoryFieldPresets("real-estate").map((field) => field.key)).toEqual([
      "adType", "rooms", "livingrooms", "area", "propertyType", "bathrooms"
    ]);
    expect(getCategoryFieldPresets("cars").map((field) => field.key)).toContain("mileage");
  });

  it("resolves supported category slug aliases", () => {
    expect(getCategoryFieldPresets("mobile-phones").map((field) => field.key)).toContain("storage");
    expect(getCategoryFieldPresets("phones-electronics").map((field) => field.key)).toContain("camera");
    expect(getCategoryFieldPresets("computers-tablets").map((field) => field.key)).toContain("processor");
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

describe("editable category field preservation", () => {
  it("keeps saved non-preset scalar fields and overlays the current editor values", () => {
    const fields = buildCategoryFieldsForEdit("real-estate", {
      rooms: "3",
      livingrooms: "2",
      legacyAkaarField: "balcony",
      numericLegacyField: 4,
      nestedLegacyField: { ignored: true }
    }, [
      { key: "rooms", value: "4" },
      { key: "legacyAkaarField", value: "" }
    ]);

    expect(fields.find((field) => field.key === "rooms")?.value).toBe("4");
    expect(fields.find((field) => field.key === "livingrooms")?.value).toBe("2");
    expect(fields.find((field) => field.key === "legacyAkaarField")?.value).toBe("");
    expect(fields.find((field) => field.key === "numericLegacyField")?.value).toBe("4");
    expect(fields.some((field) => field.key === "nestedLegacyField")).toBe(false);
  });

  it("does not mutate the saved JSON object or current field array", () => {
    const saved = { custom: "saved" };
    const current = [{ key: "custom", value: "edited" }];
    buildCategoryFieldsForEdit("unknown-category", saved, current);
    expect(saved).toEqual({ custom: "saved" });
    expect(current).toEqual([{ key: "custom", value: "edited" }]);
  });
});

describe("custom field update merge", () => {
  it("preserves nested legacy JSON while updating and clearing visible scalar fields", () => {
    const saved = {
      rooms: "3",
      legacyText: "keep until cleared",
      structuredLegacy: { source: "Akaar", values: [1, 2] }
    };
    const merged = mergeEditedCategoryFields(saved, [
      { key: "rooms", value: "4" },
      { key: "legacyText", value: " " },
      { key: "newField", value: "new value" }
    ]);

    expect(merged).toEqual({
      rooms: "4",
      structuredLegacy: { source: "Akaar", values: [1, 2] },
      newField: "new value"
    });
    expect(saved.structuredLegacy).toEqual({ source: "Akaar", values: [1, 2] });
  });
});
