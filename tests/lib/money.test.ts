import { describe, expect, it } from "vitest";
import { toMinorUnits } from "@/lib/money";

describe("toMinorUnits", () => {
  it("converts decimal major units exactly for different currency precisions", () => {
    expect(toMinorUnits("12.34", 2)).toBe("1234");
    expect(toMinorUnits("7.5", 2)).toBe("750");
    expect(toMinorUnits("125", 0)).toBe("125");
    expect(toMinorUnits("0.125", 3)).toBe("125");
  });

  it("accepts only zeroes beyond the currency precision", () => {
    expect(toMinorUnits("1.2300", 2)).toBe("123");
    expect(() => toMinorUnits("1.231", 2)).toThrow(/decimal places/i);
  });

  it("rejects negative, malformed, and unsupported values", () => {
    expect(() => toMinorUnits("-1.00", 2)).toThrow();
    expect(() => toMinorUnits("1e3", 2)).toThrow();
    expect(() => toMinorUnits("1.00", 7)).toThrow();
  });
});
