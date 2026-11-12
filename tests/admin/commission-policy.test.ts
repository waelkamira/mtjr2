import { describe, expect, it } from "vitest";
import {
  allocateDiscountAcrossLines,
  calculateCommissionMinor,
  selectCommissionRule,
  type CommissionRuleCandidate
} from "../../src/server/admin/commission-policy";

const now = new Date("2026-11-06T12:00:00.000Z");
function rule(id: string, sellerId: string | null, categoryId: string | null, rateBasisPoints = 500): CommissionRuleCandidate {
  return {
    id, sellerId, categoryId, rateBasisPoints,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: null, isActive: true, deactivatedAt: null
  };
}

describe("commission policy", () => {
  it("uses seller+category, seller, category, then global precedence", () => {
    const candidates = [
      rule("global", null, null, 100),
      rule("category", null, "cat-1", 200),
      rule("seller", "seller-1", null, 300),
      rule("seller-category", "seller-1", "cat-1", 400)
    ];
    expect(selectCommissionRule(candidates, "seller-1", "cat-1", now).rule?.id).toBe("seller-category");
    expect(selectCommissionRule(candidates.slice(0, 3), "seller-1", "cat-1", now).rule?.id).toBe("seller");
    expect(selectCommissionRule([candidates[0], candidates[1]], "seller-1", "cat-1", now).rule?.id).toBe("category");
    expect(selectCommissionRule([candidates[0]], "seller-1", null, now).rule?.id).toBe("global");
  });

  it("does not apply inactive, future, or expired rules", () => {
    const future = { ...rule("future", null, null), effectiveFrom: new Date("2027-01-01T00:00:00.000Z") };
    const expired = { ...rule("expired", null, null), effectiveUntil: new Date("2026-01-01T00:00:00.000Z") };
    const alreadyDeactivated = { ...rule("inactive", null, null), deactivatedAt: new Date("2026-11-06T11:00:00.000Z") };
    const deactivatedAfterEvent = { ...rule("late-webhook", null, null), deactivatedAt: new Date("2026-11-06T13:00:00.000Z") };
    expect(selectCommissionRule([future, expired, alreadyDeactivated], "seller-1", null, now)).toEqual({ rule: null, scope: "NONE" });
    expect(selectCommissionRule([deactivatedAfterEvent], "seller-1", null, now).rule?.id).toBe("late-webhook");
  });

  it("rounds minor-unit commission amounts half up and validates rates", () => {
    expect(calculateCommissionMinor(BigInt(101), 500)).toBe(BigInt(5));
    expect(calculateCommissionMinor(BigInt(100), 500)).toBe(BigInt(5));
    expect(calculateCommissionMinor(BigInt(100), 10_000)).toBe(BigInt(100));
    expect(() => calculateCommissionMinor(BigInt(10), 10_001)).toThrow();
  });

  it("preserves the exact net merchandise total for a full discount allocation", () => {
    const bases = allocateDiscountAcrossLines([
      { id: "item-1", lineTotalMinor: BigInt(125) },
      { id: "item-2", lineTotalMinor: BigInt(75) }
    ], BigInt(200));
    expect(bases.get("item-1")).toBe(BigInt(0));
    expect(bases.get("item-2")).toBe(BigInt(0));
    expect([...bases.values()].reduce((sum, amount) => sum + amount, BigInt(0))).toBe(BigInt(0));
  });

  it("rejects discounts outside the merchandise subtotal and negative line values", () => {
    expect(() => allocateDiscountAcrossLines([
      { id: "item-1", lineTotalMinor: BigInt(100) }
    ], BigInt(101))).toThrow("within the merchandise subtotal");
    expect(() => allocateDiscountAcrossLines([
      { id: "item-1", lineTotalMinor: BigInt(-1) }
    ], BigInt(0))).toThrow("Line totals cannot be negative");
  });

  it("allocates discounts proportionally with deterministic remainder reconciliation", () => {
    const bases = allocateDiscountAcrossLines([
      { id: "item-b", lineTotalMinor: BigInt(100) },
      { id: "item-a", lineTotalMinor: BigInt(200) }
    ], BigInt(10));
    expect(bases.get("item-a")).toBe(BigInt(193));
    expect(bases.get("item-b")).toBe(BigInt(97));
    expect([...bases.values()].reduce((sum, amount) => sum + amount, BigInt(0))).toBe(BigInt(290));
  });
});
