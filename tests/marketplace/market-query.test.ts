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
    mocks.marketFindMany.mockResolvedValue([market("SY-SYR", "SYP", ["SYP", "USD"])]);
    mocks.marketFindFirst.mockResolvedValue({
      id: "market-syria", code: "SY-SYR", name: "Syria",
      defaultCurrency: { code: "SYP" },
      currencies: [{ currency: { code: "SYP" } }, { currency: { code: "USD" } }]
    });
  });

  it("lists Syria as the only launch market", async () => {
    const rows = await listActiveMarkets();
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe("SY-SYR");
    expect(mocks.marketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ code: "SY-SYR", status: "ACTIVE" }), take: 200
    }));
  });

  it("exposes only Syrian market currencies and country", async () => {
    expect(await listActiveMarketCurrencies()).toEqual([
      { code: "SYP", name: "SYP", symbol: null, minorUnit: 2 },
      { code: "USD", name: "USD", symbol: null, minorUnit: 2 }
    ]);
    expect(await listActiveMarketCountries()).toHaveLength(1);
  });

  it("allows only Syria and refuses a disabled default currency", async () => {
    expect(await getActiveMarketByCode("nl-eu")).toBeNull();
    expect(mocks.marketFindFirst).not.toHaveBeenCalled();
    await getActiveMarketByCode("sy-syr");
    expect(mocks.marketFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ code: "SY-SYR", status: "ACTIVE" })
    }));
    mocks.marketFindFirst.mockResolvedValue({
      defaultCurrency: { code: "SYP" }, currencies: [{ currency: { code: "USD" } }]
    });
    expect(await getActiveMarketByCode("SY-SYR")).toBeNull();
  });
});
