import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const marketCodeSchema = z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/);

export async function getActiveMarketByCode(input: string) {
  const code = marketCodeSchema.parse(input).toUpperCase();
  if (code !== "SY-SYR") return null;

  const market = await prisma.market.findFirst({
    where: {
      code,
      status: "ACTIVE",
      country: { is: { isActive: true } },
      defaultCurrency: { is: { isActive: true } },
    },
    select: {
      id: true,
      code: true,
      name: true,
      country: { select: { iso2: true, iso3: true, name: true } },
      defaultCurrency: {
        select: { code: true, name: true, symbol: true, minorUnit: true }
      },
      currencies: {
        where: { isEnabled: true, currency: { isActive: true } },
        select: {
          currency: { select: { code: true, name: true, symbol: true, minorUnit: true } }
        },
        orderBy: { currencyCode: "asc" }
      }
    }
  });

  if (!market) return null;
  const defaultCurrencyIsEnabled = market.currencies.some(
    ({ currency }) => currency.code === market.defaultCurrency.code
  );
  return defaultCurrencyIsEnabled ? market : null;
}


/** Lists only operational markets whose default currency is enabled in that market. */
export async function listActiveMarkets() {
  const rows = await prisma.market.findMany({
    where: {
      code: "SY-SYR",
      status: "ACTIVE",
      country: { is: { isActive: true } },
      defaultCurrency: { is: { isActive: true } },
      currencies: { some: { isEnabled: true, currency: { isActive: true } } }
    },
    orderBy: [{ code: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true, code: true, name: true,
      country: { select: { iso2: true, iso3: true, name: true } },
      defaultCurrency: { select: { code: true, name: true, symbol: true, minorUnit: true } },
      currencies: {
        where: { isEnabled: true, currency: { isActive: true } },
        orderBy: { currencyCode: "asc" },
        select: { currency: { select: { code: true, name: true, symbol: true, minorUnit: true } } }
      }
    }
  });
  return rows.filter((market) =>
    market.currencies.some(({ currency }) => currency.code === market.defaultCurrency.code)
  );
}

/** Currency options are derived from enabled currencies in active markets only. */
export async function listActiveMarketCurrencies() {
  const markets = await listActiveMarkets();
  const currencies = new Map<string, { code: string; name: string; symbol: string | null; minorUnit: number }>();
  for (const market of markets) {
    for (const { currency } of market.currencies) currencies.set(currency.code, currency);
  }
  return [...currencies.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Country options are limited to countries with at least one valid active market. */
export async function listActiveMarketCountries() {
  const markets = await listActiveMarkets();
  const countries = new Map<string, { iso2: string; iso3: string | null; name: string }>();
  for (const market of markets) countries.set(market.country.iso2, market.country);
  return [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
}
