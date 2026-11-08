import { describe, expect, it } from "vitest";
import { toMinorUnits } from "@/lib/money";

describe("toMinorUnits", () => {
  it("converts whole and fractional currency amounts exactly", () => {
    expect(toMinorUnits("12", 2)).toBe("1200");
    expect(toMinorUnits("12.3", 2)).toBe("1230");
    expect(toMinorUnits("12.34", 2)).toBe("1234");
    expect(toMinorUnits("12.345", 3)).toBe("12345");
    expect(toMinorUnits("12", 0)).toBe("12");
  });

  it("rejects precision beyond the currency's supported minor unit", () => {
    expect(() => toMinorUnits("12.345", 2)).toThrow(/decimal places/i);
    expect(() => toMinorUnits("1.1", 0)).toThrow(/decimal places/i);
  });

  it("rejects invalid, negative, and out-of-range values", () => {
    for (const value of ["", "-1", "1e3", "1.2.3", "01.25"]) {
      expect(() => toMinorUnits(value, 2)).toThrow();
    }
    expect(() => toMinorUnits("90000000000000.01", 2)).toThrow(/supported limit/i);
  });
});
