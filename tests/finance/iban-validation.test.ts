import { describe, expect, it } from "vitest";
import { isValidSellerIban } from "@/server/finance/iban-validation";

describe("seller IBAN validation", () => {
  it("accepts a valid French IBAN with the country-specific length", () => {
    expect(isValidSellerIban("FR14 2004 1010 0505 0001 3M02 606")).toBe(true);
  });

  it("accepts a valid German IBAN", () => {
    expect(isValidSellerIban("DE89370400440532013000")).toBe(true);
  });

  it("rejects an IBAN with a valid checksum but incorrect country length", () => {
    expect(isValidSellerIban("FR1420041010050500013M0260")).toBe(false);
  });

  it("rejects an invalid checksum", () => {
    expect(isValidSellerIban("FR1420041010050500013M02607")).toBe(false);
  });

  it("rejects unsupported country prefixes", () => {
    expect(isValidSellerIban("ZZ1420041010050500013M02606")).toBe(false);
  });
});
