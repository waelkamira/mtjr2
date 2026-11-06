import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(), campaignFind: vi.fn(),
  eventFind: vi.fn(), aggregate: vi.fn(), eventCreate: vi.fn(), campaignUpdate: vi.fn(), ledgerCreate: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "a".repeat(48), TRUSTED_PROXY_IP_HEADER: undefined, NODE_ENV: "test" } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { adCampaign: { findMany: mocks.findMany }, $transaction: mocks.transaction } }));
import { listSponsoredCampaigns, recordSponsoredAdEvent } from "@/server/advertising/delivery";

const row = {
  id: "campaign-1", budgetMinor: 10000n, dailyBudgetMinor: 2000n, cpcBidMinor: 100n, spentMinor: 0n,
  targetKeywords: ["running"], spendEntries: [], product: {
    id: "product-1", slug: "shoe", name: "Running shoe", description: null, brand: null,
    store: { id: "store-1", name: "Store", slug: "store" },
    media: [], variants: [{ prices: [{ amountMinor: 1200n, currencyCode: "EUR", currency: { minorUnit: 2 } }] }]
  }
};
const tx = {
  $queryRaw: mocks.queryRaw,
  adCampaign: { findUnique: mocks.campaignFind, update: mocks.campaignUpdate },
  adCampaignEvent: { findUnique: mocks.eventFind, create: mocks.eventCreate },
  adSpendLedgerEntry: { aggregate: mocks.aggregate, create: mocks.ledgerCreate }
};
describe("sponsored ad delivery and billing ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([row]);
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    mocks.queryRaw.mockResolvedValue([]);
    mocks.campaignFind.mockResolvedValue({ id: "campaign-1", storeId: "store-1", currencyCode: "EUR", status: "ACTIVE", startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"), budgetMinor: 10000n, dailyBudgetMinor: 2000n, cpcBidMinor: 100n, spentMinor: 0n });
    mocks.eventFind.mockResolvedValue(null);
    mocks.aggregate.mockResolvedValue({ _sum: { amountMinor: 0n } });
    mocks.eventCreate.mockResolvedValue({ id: "event-1" });
    mocks.campaignUpdate.mockResolvedValue({});
    mocks.ledgerCreate.mockResolvedValue({});
  });
  it("returns sponsored products only for a requested market and matching target keywords", async () => {
    const items = await listSponsoredCampaigns({ marketId: "market-1", query: "running shoes", now: new Date("2026-11-07T12:00:00Z") });
    expect(items).toHaveLength(1);
    expect(items[0].product.variants[0].prices[0].amountMinor).toBe("1200");
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ marketId: "market-1" }) }));
    expect(await listSponsoredCampaigns({ query: "running" })).toEqual([]);
  });
  it("records a signed impression once and increments the impression count", async () => {
    const [ad] = await listSponsoredCampaigns({ marketId: "market-1", query: "running", now: new Date("2026-11-07T12:00:00Z") });
    const result = await recordSponsoredAdEvent({ token: ad.token, eventId: "eventidentifier123456", type: "IMPRESSION", headers: new Headers(), now: new Date("2026-11-07T12:01:00Z") });
    expect(result).toMatchObject({ accepted: true, duplicate: false, chargedMinor: "0" });
    expect(mocks.campaignUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { impressionCount: { increment: 1n } } }));
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });
  it("records click spend atomically in the ledger and enforces the daily cap", async () => {
    const [ad] = await listSponsoredCampaigns({ marketId: "market-1", query: "running", now: new Date("2026-11-07T12:00:00Z") });
    const result = await recordSponsoredAdEvent({ token: ad.token, eventId: "clickidentifier123456", type: "CLICK", headers: new Headers(), now: new Date("2026-11-07T12:01:00Z") });
    expect(result.chargedMinor).toBe("100");
    expect(mocks.ledgerCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountMinor: 100n, currencyCode: "EUR" }) }));
    mocks.aggregate.mockResolvedValue({ _sum: { amountMinor: 2000n } });
    await expect(recordSponsoredAdEvent({ token: ad.token, eventId: "clickidentifier123457", type: "CLICK", headers: new Headers(), now: new Date("2026-11-07T12:02:00Z") })).rejects.toThrow(/budget limit/i);
  });
  it("rejects a forged or expired tracking token", async () => {
    await expect(recordSponsoredAdEvent({ token: "forged.token", eventId: "eventidentifier123456", type: "CLICK", headers: new Headers() })).rejects.toThrow(/invalid or expired/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
