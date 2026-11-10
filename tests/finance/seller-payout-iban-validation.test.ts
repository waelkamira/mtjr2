import { describe, expect, it } from "vitest";
import { isValidSellerIban } from "@/server/finance/iban-validation";

describe("seller IBAN validation", () => {
  it("accepts a valid IBAN with whitespace and lowercase input", () => {
    expect(isValidSellerIban("de89 3704 0044 0532 0130 00")).toBe(true);
  });

  it("rejects an invalid MOD-97 checksum", () => {
    expect(isValidSellerIban("DE89370400440532013001")).toBe(false);
  });

  it("rejects an IBAN whose length does not match its country", () => {
    expect(isValidSellerIban("DE8937040044053201300")).toBe(false);
  });

  it("rejects unknown country prefixes and malformed values", () => {
    expect(isValidSellerIban("ZZ89370400440532013000")).toBe(false);
    expect(isValidSellerIban("not-an-iban")).toBe(false);
  });
});
