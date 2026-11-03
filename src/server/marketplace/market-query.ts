import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const marketCodeSchema = z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/);

export async function getActiveMarketByCode(input: string) {
  const code = marketCodeSchema.parse(input);

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
