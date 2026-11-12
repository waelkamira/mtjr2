/**
 * Pure, fail-closed resolver for versioned marketplace financial policies.
 * This module selects configuration only; it never posts journals or authorizes payouts.
 */

export type FinancialPolicyClassification = "LEGAL" | "CONTRACTUAL" | "PLATFORM";
export type FinancialPolicyApproval = "APPROVED" | "PENDING_REVIEW" | "REJECTED";

export type FinancialPolicyContext = {
  domain: string;
  countryCode: string;
  subdivisionCode?: string | null;
  marketId?: string | null;
  currencyCode: string;
  productClass?: string | null;
  paymentProvider?: string | null;
  sellerId?: string | null;
};

export type FinancialPolicyRule<T = unknown> = {
  id: string;
  version: number;
  domain: string;
  classification: FinancialPolicyClassification;
  approval: FinancialPolicyApproval;
  value: T;
  countryCode?: string | null;
  subdivisionCode?: string | null;
  marketId?: string | null;
  currencyCode?: string | null;
  productClass?: string | null;
  paymentProvider?: string | null;
  sellerId?: string | null;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  sourceReference?: string | null;
  reviewedAt?: Date | null;
};

export type FinancialPolicyResolution<T> =
  | { status: "APPLICABLE"; rule: FinancialPolicyRule<T>; matchedScope: string; evaluatedAt: Date }
  | { status: "MISSING_CONFIGURATION" | "REVIEW_REQUIRED" | "CONFLICT" | "UNSUPPORTED"; reason: string; evaluatedAt: Date; candidateRuleIds: string[] };

const normalize = (value?: string | null) => value?.trim().toUpperCase() || null;

function matches<T>(rule: FinancialPolicyRule<T>, context: FinancialPolicyContext): boolean {
  const dimensions: Array<[string | null | undefined, string | null | undefined]> = [
    [rule.countryCode, context.countryCode],
    [rule.subdivisionCode, context.subdivisionCode],
    [rule.marketId, context.marketId],
    [rule.currencyCode, context.currencyCode],
    [rule.productClass, context.productClass],
    [rule.paymentProvider, context.paymentProvider],
    [rule.sellerId, context.sellerId]
  ];
  return dimensions.every(([configured, actual]) =>
    configured == null || normalize(configured) === normalize(actual)
  );
}

function specificity<T>(rule: FinancialPolicyRule<T>): number {
  return [
    rule.countryCode, rule.subdivisionCode, rule.marketId, rule.currencyCode,
    rule.productClass, rule.paymentProvider, rule.sellerId
  ].filter((value) => value != null).length;
}

function stableValue(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value, Object.keys((value && typeof value === "object" && !Array.isArray(value)) ? value as object : {}).sort());
}

/**
 * Precedence: mandatory legal > contractual > platform. Within a classification,
 * the most specifically scoped rule wins. Equal-rank incompatible rules block.
 * A matching rule awaiting review blocks fallback to a less-specific rule.
 */
export function resolveFinancialPolicy<T>(
  rules: readonly FinancialPolicyRule<T>[],
  context: FinancialPolicyContext,
  evaluatedAt = new Date()
): FinancialPolicyResolution<T> {
  const countryCode = normalize(context.countryCode);
  const currencyCode = normalize(context.currencyCode);
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode) || !currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) {
    return { status: "UNSUPPORTED", reason: "A valid country and ISO currency code are required.", evaluatedAt, candidateRuleIds: [] };
  }

  const eligible = rules.filter((rule) =>
    rule.domain === context.domain &&
    (!rule.effectiveFrom || rule.effectiveFrom <= evaluatedAt) &&
    (!rule.effectiveUntil || rule.effectiveUntil > evaluatedAt) &&
    matches(rule, context) &&
    // Legal rules must always be explicitly tied to a country.
    (rule.classification !== "LEGAL" || normalize(rule.countryCode) === countryCode)
  );

  if (eligible.length === 0) {
    return { status: "MISSING_CONFIGURATION", reason: "No active policy matches this operation and jurisdiction.", evaluatedAt, candidateRuleIds: [] };
  }

  const rank = (rule: FinancialPolicyRule<T>) =>
    (rule.classification === "LEGAL" ? 300 : rule.classification === "CONTRACTUAL" ? 200 : 100) + specificity(rule);
  const highestRank = Math.max(...eligible.map(rank));
  const winners = eligible.filter((rule) => rank(rule) === highestRank);
  const pending = winners.filter((rule) => rule.approval !== "APPROVED");
  if (pending.length > 0) {
    return {
      status: "REVIEW_REQUIRED",
      reason: "The highest-precedence matching policy is not approved; fallback is prohibited.",
      evaluatedAt,
      candidateRuleIds: pending.map((rule) => rule.id)
    };
  }

  const distinctValues = new Set(winners.map((rule) => stableValue(rule.value)));
  if (distinctValues.size > 1) {
    return {
      status: "CONFLICT",
      reason: "Equally specific policies at the same precedence level disagree.",
      evaluatedAt,
      candidateRuleIds: winners.map((rule) => rule.id)
    };
  }

  const selected = [...winners].sort((a, b) => b.version - a.version || a.id.localeCompare(b.id))[0];
  return {
    status: "APPLICABLE",
    rule: selected,
    matchedScope: [
      selected.countryCode && "COUNTRY",
      selected.subdivisionCode && "SUBDIVISION",
      selected.marketId && "MARKET",
      selected.currencyCode && "CURRENCY",
      selected.productClass && "PRODUCT_CLASS",
      selected.paymentProvider && "PAYMENT_PROVIDER",
      selected.sellerId && "SELLER"
    ].filter(Boolean).join("+") || "GLOBAL",
    evaluatedAt
  };
}
