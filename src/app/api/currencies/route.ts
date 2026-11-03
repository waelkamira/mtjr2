import { listActiveMarketCurrencies } from "@/server/marketplace/market-query";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const currencies = await listActiveMarketCurrencies();
  return Response.json({ items: currencies }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
  });
}
