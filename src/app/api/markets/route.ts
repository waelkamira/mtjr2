import { listActiveMarkets } from "@/server/marketplace/market-query";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const markets = await listActiveMarkets();
  return Response.json({ items: markets }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
  });
}
