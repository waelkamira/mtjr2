import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(), groupBy: vi.fn(), invoiceGroupBy: vi.fn(), createMany: vi.fn(), transaction: vi.fn(),
  campaignAggregate: vi.fn(), activeCampaignCount: vi.fn(), currencyFindMany: vi.fn(),
  invoiceFind: vi.fn(), invoiceUpdate: vi.fn(), invoiceFindOrThrow: vi.fn(), audit: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "a".repeat(48), TRUSTED_PROXY_IP_HEADER: undefined, NODE_ENV: "test" } }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adSpendLedgerEntry: { groupBy: mocks.groupBy },
    adCampaign: { aggregate: mocks.campaignAggregate, count: mocks.activeCampaignCount },
    currency: { findMany: mocks.currencyFindMany },
    adInvoice: { createMany: mocks.createMany, groupBy: mocks.invoiceGroupBy },
    $transaction: mocks.transaction
  }
}));
import { generateAdInvoices, getAdminAdvertisingAnalytics, settleAdInvoice } from "@/server/advertising/delivery";
const tx = {
  adInvoice: { findUnique: mocks.invoiceFind, updateMany: mocks.invoiceUpdate, findUniqueOrThrow: mocks.invoiceFindOrThrow },
  auditLog: { create: mocks.audit }
};
describe("advertising invoice ledger and settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permission.mockResolvedValue({ userId: "admin-1" });
    mocks.groupBy.mockResolvedValue([{ storeId: "store-1", currencyCode: "EUR", _sum: { amountMinor: BigInt(1250) } }]);
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.campaignAggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { impressionCount: BigInt(250), clickCount: BigInt(12) } });
    mocks.activeCampaignCount.mockResolvedValue(1);
    mocks.invoiceGroupBy.mockResolvedValue([{ currencyCode: "JPY", status: "OPEN", _sum: { amountMinor: BigInt(1234) }, _count: { _all: 1 } }]);
    mocks.currencyFindMany.mockResolvedValue([{ code: "EUR", minorUnit: 2 }, { code: "JPY", minorUnit: 0 }]);
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    mocks.invoiceFind.mockResolvedValue({ id: "invoice-1", status: "OPEN", storeId: "store-1", amountMinor: BigInt(1250), currencyCode: "EUR" });
    mocks.invoiceUpdate.mockResolvedValue({ count: 1 });
    mocks.invoiceFindOrThrow.mockResolvedValue({ id: "invoice-1", status: "SETTLED", paymentReference: "BANK-REF-123", settledAt: new Date("2026-11-07T12:00:00Z"), amountMinor: BigInt(1250), currencyCode: "EUR", dueAt: new Date("2026-11-20T00:00:00Z") });
    mocks.audit.mockResolvedValue({});
  });
  it("returns currency precision with cross-currency analytics totals", async () => {
    mocks.groupBy.mockResolvedValue([{ currencyCode: "EUR", _sum: { amountMinor: BigInt(1234) } }]);
    const result = await getAdminAdvertisingAnalytics(new Date("2026-11-08T12:00:00Z"));
    expect(result.spendByCurrency).toEqual([{ currencyCode: "EUR", amountMinor: "1234", minorUnit: 2 }]);
    expect(result.invoicesByCurrency).toEqual([{ currencyCode: "JPY", status: "OPEN", amountMinor: "1234", minorUnit: 0, count: 1 }]);
    expect(result.impressions).toBe("250");
    expect(result.clicks).toBe("12");
  });

  it("creates idempotent monthly invoices from immutable spend ledger totals", async () => {
    const periodStart = new Date("2026-10-01T00:00:00Z");
    const periodEnd = new Date("2026-11-01T00:00:00Z");
    const result = await generateAdInvoices({ periodStart, periodEnd, dueAt: new Date("2026-11-15T00:00:00Z") });
    expect(result).toEqual({ created: 1, stores: 1 });
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true, data: [expect.objectContaining({ amountMinor: BigInt(1250), currencyCode: "EUR" })] }));
  });
  it("requires a meaningful external payment reference and records settlement atomically", async () => {
    await expect(settleAdInvoice("invoice-1", "  ")).rejects.toThrow(/reference/i);
    const result = await settleAdInvoice("invoice-1", "BANK-REF-123", new Date("2026-11-07T12:00:00Z"));
    expect(result.amountMinor).toBe("1250");
    expect(mocks.invoiceUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "invoice-1", status: "OPEN" }, data: expect.objectContaining({ status: "SETTLED", paymentReference: "BANK-REF-123", settledById: "admin-1" }) }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "advertising.invoice.settled", resourceId: "invoice-1" }) }));
  });
  it("rejects settling an already closed invoice", async () => {
    mocks.invoiceFind.mockResolvedValue({ id: "invoice-1", status: "SETTLED", storeId: "store-1" });
    await expect(settleAdInvoice("invoice-1", "BANK-REF-123")).rejects.toThrow(/only open/i);
    expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
  });
});
