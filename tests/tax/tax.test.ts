import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasPermission: vi.fn(),
  getCheckoutQuote: vi.fn(),
  marketFindFirst: vi.fn(),
  marketTaxRateCreate: vi.fn(),
  marketTaxRateFindMany: vi.fn(),
  auditCreate: vi.fn(),
  checkoutQuoteFindFirst: vi.fn(),
  snapshotUpsert: vi.fn(),
  snapshotDeleteMany: vi.fn()
}));

const tx = {
  market: { findFirst: mocks.marketFindFirst },
  marketTaxRate: {
    create: mocks.marketTaxRateCreate,
    findMany: mocks.marketTaxRateFindMany
  },
  auditLog: { create: mocks.auditCreate },
  checkoutQuote: { findFirst: mocks.checkoutQuoteFindFirst },
  checkoutTaxSnapshot: {
    upsert: mocks.snapshotUpsert,
    deleteMany: mocks.snapshotDeleteMany
  }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx))
  }
}));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: mocks.userHasPermission
}));
vi.mock("@/server/checkout/quotes", () => ({
  getCheckoutQuote: mocks.getCheckoutQuote
}));

import { CheckoutQuoteStatus } from "@prisma/client";
import { calculateCheckoutTax, createMarketTaxRate } from "@/server/tax/tax";

const now = new Date("2026-11-04T12:00:00.000Z");

describe("market tax configuration and checkout calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "admin-1" });
    mocks.userHasPermission.mockResolvedValue(true);
    mocks.marketFindFirst.mockResolvedValue({ id: "market-1" });
    mocks.marketTaxRateCreate.mockResolvedValue({
      id: "rate-1", marketId: "market-1", name: "Regional VAT",
      destinationRegion: "CA", rateBasisPoints: 2000, isInclusive: false,
      appliesToShipping: true, isActive: true, effectiveFrom: null,
      effectiveUntil: null, priority: 0
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.getCheckoutQuote.mockResolvedValue({ status: CheckoutQuoteStatus.ACTIVE });
    mocks.checkoutQuoteFindFirst.mockResolvedValue({
      id: "quote-1", status: CheckoutQuoteStatus.ACTIVE,
      expiresAt: new Date("2026-11-04T12:10:00.000Z"),
      marketId: "market-1", currencyCode: "EUR", subtotalMinor: BigInt(10000),
      deliveryAddress: { region: "CA" },
      lines: [{ storeId: "store-1" }],
      shippingSelections: [{ storeId: "store-1", amountMinor: BigInt(500) }],
      currency: { minorUnit: 2 }
    });
    mocks.marketTaxRateFindMany.mockResolvedValue([{
      id: "rate-1", name: "Regional VAT", destinationRegion: "CA",
      rateBasisPoints: 2000, isInclusive: false, appliesToShipping: true
    }]);
    mocks.snapshotUpsert.mockImplementation(async ({ create }) => create);
    mocks.snapshotDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("creates an active-market tax rule and records an audit event", async () => {
    const result = await createMarketTaxRate({
      marketId: "market-1", name: "Regional VAT", destinationRegion: "CA",
      rateBasisPoints: 2000, appliesToShipping: true
    }, now);

    expect(result.id).toBe("rate-1");
    expect(mocks.marketFindFirst).toHaveBeenCalledWith({
      where: { id: "market-1", status: "ACTIVE" }, select: { id: true }
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects tax-rule creation without platform administration permission", async () => {
    mocks.userHasPermission.mockResolvedValue(false);

    await expect(createMarketTaxRate({
      marketId: "market-1", name: "Regional VAT", rateBasisPoints: 2000
    }, now)).rejects.toThrow("platform administration permission");

    expect(mocks.marketTaxRateCreate).not.toHaveBeenCalled();
  });

  it("calculates exclusive tax on items and selected shipping, then snapshots the result", async () => {
    const result = await calculateCheckoutTax("guest-token", "quote-1", now);

    expect(result).toMatchObject({
      configured: true,
      taxableAmountMinor: "10500",
      taxAmountMinor: "2100",
      amountDueMinor: "12600",
      currencyCode: "EUR"
    });
    expect(mocks.snapshotUpsert).toHaveBeenCalledOnce();
  });

  it("returns a configuration-required result when any seller has no shipping selection", async () => {
    mocks.checkoutQuoteFindFirst.mockResolvedValue({
      ...mocks.checkoutQuoteFindFirst.mock.results[0]?.value,
      deliveryAddress: { region: "CA" },
      lines: [{ storeId: "store-1" }, { storeId: "store-2" }],
      shippingSelections: [{ storeId: "store-1", amountMinor: BigInt(500) }]
    });

    const result = await calculateCheckoutTax("guest-token", "quote-1", now);

    expect(result).toMatchObject({ configured: false, requiresShippingSelection: true });
    expect(mocks.marketTaxRateFindMany).not.toHaveBeenCalled();
  });

  it("does not invent a rate when no market or region rule is configured", async () => {
    mocks.marketTaxRateFindMany.mockResolvedValue([]);

    const result = await calculateCheckoutTax("guest-token", "quote-1", now);

    expect(result).toMatchObject({ configured: false, requiresShippingSelection: false });
    expect(mocks.snapshotDeleteMany).toHaveBeenCalledWith({ where: { quoteId: "quote-1" } });
  });

  it("uses inclusive tax arithmetic without adding tax twice to the amount due", async () => {
    mocks.marketTaxRateFindMany.mockResolvedValue([{
      id: "rate-1", name: "Regional VAT", destinationRegion: "CA",
      rateBasisPoints: 2000, isInclusive: true, appliesToShipping: false
    }]);

    const result = await calculateCheckoutTax("guest-token", "quote-1", now);

    expect(result).toMatchObject({
      configured: true,
      taxableAmountMinor: "10000",
      taxAmountMinor: "1667",
      amountDueMinor: "10500"
    });
  });
});
