import { describe, expect, it } from "vitest";
import { buildReversalLines, validateJournalLines, type JournalLineInput } from "@/server/accounting/journal";

const balanced: JournalLineInput[] = [
  { accountId: "cash", side: "DEBIT", amountMinor: BigInt(1250), currencyCode: "EUR" },
  { accountId: "seller-payable", side: "CREDIT", amountMinor: BigInt(1000), currencyCode: "EUR" },
  { accountId: "platform-revenue", side: "CREDIT", amountMinor: BigInt(250), currencyCode: "EUR" }
];

describe("journal invariants", () => {
  it("accepts balanced multi-line postings in one currency", () => {
    expect(validateJournalLines(balanced)).toMatchObject({
      currencyCode: "EUR",
      debitTotalMinor: BigInt(1250),
      creditTotalMinor: BigInt(1250)
    });
  });

  it("rejects unbalanced entries", () => {
    expect(() => validateJournalLines([
      balanced[0],
      { ...balanced[1], amountMinor: BigInt(999) },
      balanced[2]
    ])).toThrow(/not balanced/i);
  });

  it("rejects mixed currencies and non-positive amounts", () => {
    expect(() => validateJournalLines([
      balanced[0],
      { ...balanced[1], currencyCode: "USD" }
    ])).toThrow(/cannot mix currencies/i);
    expect(() => validateJournalLines([
      balanced[0],
      { ...balanced[1], amountMinor: BigInt(0) }
    ])).toThrow(/must be positive/i);
  });

  it("creates a balanced reversal by swapping every side", () => {
    const reversal = buildReversalLines(balanced);
    expect(reversal.map((line) => line.side)).toEqual(["CREDIT", "DEBIT", "DEBIT"]);
    expect(validateJournalLines(reversal).debitTotalMinor).toBe(BigInt(1250));
    expect(reversal[0].memo).toBe("Reversal");
  });

  it("does not permit a one-line journal", () => {
    expect(() => validateJournalLines([balanced[0]])).toThrow(/at least two lines/i);
  });
});
