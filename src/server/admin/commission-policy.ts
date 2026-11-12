export type CommissionRuleCandidate = {
  id: string;
  sellerId: string | null;
  categoryId: string | null;
  rateBasisPoints: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isActive: boolean;
  deactivatedAt: Date | null;
};

export type CommissionScope = "SELLER_CATEGORY" | "SELLER" | "CATEGORY" | "GLOBAL" | "NONE";

export function selectCommissionRule(
  rules: readonly CommissionRuleCandidate[],
  sellerId: string,
  categoryId: string | null,
  at: Date
): { rule: CommissionRuleCandidate | null; scope: CommissionScope } {
  const active = rules.filter((rule) =>
    rule.effectiveFrom <= at &&
    (rule.effectiveUntil === null || rule.effectiveUntil > at) &&
    (rule.deactivatedAt === null || rule.deactivatedAt > at)
  );
  const scopes: Array<{ scope: Exclude<CommissionScope, "NONE">; matches: (rule: CommissionRuleCandidate) => boolean }> = [
    { scope: "SELLER_CATEGORY", matches: (rule) => categoryId !== null && rule.sellerId === sellerId && rule.categoryId === categoryId },
    { scope: "SELLER", matches: (rule) => rule.sellerId === sellerId && rule.categoryId === null },
    { scope: "CATEGORY", matches: (rule) => rule.sellerId === null && categoryId !== null && rule.categoryId === categoryId },
    { scope: "GLOBAL", matches: (rule) => rule.sellerId === null && rule.categoryId === null }
  ];

  for (const { scope, matches } of scopes) {
    const rule = active.find(matches);
    if (rule) return { rule, scope };
  }
  return { rule: null, scope: "NONE" };
}

export function calculateCommissionMinor(baseAmountMinor: bigint, rateBasisPoints: number): bigint {
  if (baseAmountMinor < BigInt(0)) throw new Error("Commission base cannot be negative.");
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10_000) {
    throw new Error("Commission rate must be between 0 and 10000 basis points.");
  }
  return (baseAmountMinor * BigInt(rateBasisPoints) + BigInt(5_000)) / BigInt(10_000);
}

export function allocateDiscountAcrossLines(
  lines: readonly { id: string; lineTotalMinor: bigint }[],
  discountMinor: bigint
): Map<string, bigint> {
  if (lines.some((line) => line.lineTotalMinor < BigInt(0))) throw new Error("Line totals cannot be negative.");
  const subtotal = lines.reduce((total, line) => total + line.lineTotalMinor, BigInt(0));
  if (discountMinor < BigInt(0) || discountMinor > subtotal) throw new Error("Discount must be within the merchandise subtotal.");
  if (subtotal === BigInt(0) && discountMinor !== BigInt(0)) throw new Error("A discount cannot be allocated across a zero-value order.");

  const allocations = lines.map((line) => {
    const numerator = discountMinor * line.lineTotalMinor;
    return {
      id: line.id,
      lineTotalMinor: line.lineTotalMinor,
      discount: subtotal === BigInt(0) ? BigInt(0) : numerator / subtotal,
      remainder: subtotal === BigInt(0) ? BigInt(0) : numerator % subtotal
    };
  });
  let remainder = discountMinor - allocations.reduce((total, line) => total + line.discount, BigInt(0));
  const ranked = [...allocations].sort((a, b) =>
    a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1
  );
  for (let index = 0; remainder > BigInt(0); index += 1, remainder -= BigInt(1)) {
    const allocation = ranked[index];
    if (!allocation) throw new Error("Discount allocation could not be reconciled.");
    allocation.discount += BigInt(1);
  }
  return new Map(allocations.map((line) => [line.id, line.lineTotalMinor - line.discount]));
}
