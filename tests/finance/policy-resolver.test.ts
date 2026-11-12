import { describe, expect, it } from "vitest";
import { resolveFinancialPolicy, type FinancialPolicyRule } from "../../src/server/finance/policy-resolver";

const at = new Date("2026-11-12T12:00:00.000Z");
const context = {
  domain: "SELLER_PAYOUT_RELEASE",
  countryCode: "FR",
  subdivisionCode: "GES",
  marketId: "market-fr",
  currencyCode: "EUR",
  productClass: "STANDARD",
  paymentProvider: "BANK_TRANSFER",
  sellerId: "seller-1"
};

function rule(overrides: Partial<FinancialPolicyRule<{ holdDays: number }>> = {}): FinancialPolicyRule<{ holdDays: number }> {
  return {
    id: "platform-default", version: 1, domain: context.domain,
    classification: "PLATFORM", approval: "APPROVED", value: { holdDays: 14 },
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveUntil: null,
    ...overrides
  };
}

describe("jurisdiction-aware financial policy resolver", () => {
  it("selects mandatory country law over more narrowly scoped platform defaults", () => {
    const legal = rule({ id: "fr-law", classification: "LEGAL", countryCode: "FR", value: { holdDays: 30 } });
    const platform = rule({ id: "seller-default", sellerId: "seller-1", marketId: "market-fr", currencyCode: "EUR" });
    const result = resolveFinancialPolicy([platform, legal], context, at);
    expect(result.status).toBe("APPLICABLE");
    if (result.status === "APPLICABLE") expect(result.rule.id).toBe("fr-law");
  });

  it("selects a more specific subdivision rule within the same legal precedence", () => {
    const country = rule({ id: "fr-country", classification: "LEGAL", countryCode: "FR", value: { holdDays: 14 } });
    const region = rule({ id: "ges-region", classification: "LEGAL", countryCode: "FR", subdivisionCode: "GES", value: { holdDays: 21 } });
    const result = resolveFinancialPolicy([country, region], context, at);
    expect(result.status).toBe("APPLICABLE");
    if (result.status === "APPLICABLE") expect(result.rule.id).toBe("ges-region");
  });

  it("fails closed when the highest-precedence matching rule awaits review", () => {
    const legal = rule({ id: "fr-law-pending", classification: "LEGAL", approval: "PENDING_REVIEW", countryCode: "FR" });
    const result = resolveFinancialPolicy([rule(), legal], context, at);
    expect(result.status).toBe("REVIEW_REQUIRED");
    if (result.status === "REVIEW_REQUIRED") expect(result.candidateRuleIds).toContain("fr-law-pending");
  });

  it("blocks incompatible rules with equal precedence and specificity", () => {
    const first = rule({ id: "legal-a", classification: "LEGAL", countryCode: "FR", value: { holdDays: 10 } });
    const second = rule({ id: "legal-b", classification: "LEGAL", countryCode: "FR", value: { holdDays: 20 } });
    const result = resolveFinancialPolicy([first, second], context, at);
    expect(result.status).toBe("CONFLICT");
  });

  it("does not use future or expired rules", () => {
    const future = rule({ id: "future", classification: "LEGAL", countryCode: "FR", effectiveFrom: new Date("2027-01-01T00:00:00.000Z") });
    const expired = rule({ id: "expired", classification: "LEGAL", countryCode: "FR", effectiveUntil: new Date("2026-01-01T00:00:00.000Z") });
    expect(resolveFinancialPolicy([future, expired], context, at).status).toBe("MISSING_CONFIGURATION");
  });

  it("requires a valid country and currency rather than guessing", () => {
    expect(resolveFinancialPolicy([rule()], { ...context, countryCode: "?" }, at).status).toBe("UNSUPPORTED");
    expect(resolveFinancialPolicy([rule()], { ...context, currencyCode: "EURO" }, at).status).toBe("UNSUPPORTED");
  });

  it("does not apply a legal rule that is not explicitly country-scoped", () => {
    const unscopedLegal = rule({ id: "invalid-legal", classification: "LEGAL" });
    expect(resolveFinancialPolicy([unscopedLegal], context, at).status).toBe("MISSING_CONFIGURATION");
  });
});
