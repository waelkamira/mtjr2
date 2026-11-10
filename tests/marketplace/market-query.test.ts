import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  marketFindMany: vi.fn(),
  marketFindFirst: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { market: { findMany: mocks.marketFindMany, findFirst: mocks.marketFindFirst } }
}));

import { getActiveMarketByCode, listActiveMarketCountries, listActiveMarketCurrencies, listActiveMarkets } from "@/server/marketplace/market-query";

const market = (code: string, defaultCode: string, currencyCodes: string[]) => ({
  id: code, code, name: code,
  country: { iso2: code.slice(0, 2), iso3: null, name: code },
  defaultCurrency: { code: defaultCode, name: defaultCode, symbol: null, minorUnit: 2 },
  currencies: currencyCodes.map((currency) => ({
    currency: { code: currency, name: currency, symbol: null, minorUnit: 2 }
  }))
});

describe("active market reference queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.marketFindMany.mockResolvedValue([market("NL-EU", "EUR", ["EUR", "USD"]), market("US-NA", "USD", ["USD"])]);
    mocks.marketFindFirst.mockResolvedValue({
      id: "market-1", code: "NL-EU", name: "Netherlands",
      defaultCurrency: { code: "EUR" },
      currencies: [{ currency: { code: "EUR" } }]
    });
  });

  it("lists only markets where the default currency is enabled", async () => {
    mocks.marketFindMany.mockResolvedValue([market("NL-EU", "EUR", ["EUR"]), market("GB-UK", "GBP", ["EUR"])]);
    const rows = await listActiveMarkets();
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe("NL-EU");
    expect(mocks.marketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "ACTIVE" }), take: 200
    }));
  });

  it("deduplicates currencies and countries across active markets", async () => {
    expect(await listActiveMarketCurrencies()).toEqual([
      { code: "EUR", name: "EUR", symbol: null, minorUnit: 2 },
      { code: "USD", name: "USD", symbol: null, minorUnit: 2 }
    ]);
    expect(await listActiveMarketCountries()).toHaveLength(2);
  });

  it("normalizes market code and refuses markets with disabled default currency", async () => {
    await getActiveMarketByCode("nl-eu");
    expect(mocks.marketFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ code: "NL-EU", status: "ACTIVE" })
    }));
    mocks.marketFindFirst.mockResolvedValue({
      defaultCurrency: { code: "EUR" }, currencies: [{ currency: { code: "USD" } }]
    });
    expect(await getActiveMarketByCode("NL-EU")).toBeNull();
  });
});
