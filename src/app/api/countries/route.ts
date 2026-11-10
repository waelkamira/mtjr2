import { listActiveMarketCountries } from "@/server/marketplace/market-query";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const countries = await listActiveMarketCountries();
  return Response.json({ items: countries }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
  });
}
