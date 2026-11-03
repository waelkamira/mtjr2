import { describe, expect, it } from "vitest";
import { normalizeEmail } from "../../src/server/identity/normalize-email";

describe("normalizeEmail", () => {
  it("trims whitespace and normalizes case", () => {
    expect(normalizeEmail("  CUSTOMER@Example.COM ")).toBe("customer@example.com");
  });

  it("applies Unicode compatibility normalization", () => {
    expect(normalizeEmail("Ａlice@example.com")).toBe("alice@example.com");
  });
});
