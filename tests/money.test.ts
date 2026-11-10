import { describe, expect, it } from "vitest";
import { formatMinorUnits, toMinorUnits } from "@/lib/money";

describe("minor-unit money utilities", () => {
  it("converts human decimal input without floating-point rounding", () => {
    expect(toMinorUnits("12.34", 2)).toBe("1234");
    expect(toMinorUnits("12.345", 3)).toBe("12345");
  });

  it("formats very large amounts without losing integer or fractional digits", () => {
    expect(formatMinorUnits("90071992547409931234", "EUR", 2, "en-US"))
      .toBe("€900,719,925,474,099,312.34");
  });

  it("supports currencies with zero and three minor-unit digits", () => {
    expect(formatMinorUnits("1200", "JPY", 0, "en-US")).toBe("¥1,200");
    expect(formatMinorUnits("12345", "KWD", 3, "en-US")).toBe("KWD 12.345");
  });

  it("preserves a negative sign for sub-unit amounts", () => {
    expect(formatMinorUnits("-5", "EUR", 2, "en-US")).toBe("-€0.05");
  });

  it("rejects malformed amounts and unsupported precision", () => {
    expect(() => formatMinorUnits("1.25", "EUR", 2)).toThrow(/integer string/i);
    expect(() => formatMinorUnits("100", "EUR", 7)).toThrow(/precision/i);
  });
});
