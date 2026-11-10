import { z } from "zod";
import { getActiveMarketByCode } from "@/server/marketplace/market-query";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> {
  try {
    const { code } = await context.params;
    const market = await getActiveMarketByCode(code);
    return market ? Response.json(market, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
    }) : Response.json({ error: "Market not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid market code." }, { status: 400 });
    return Response.json({ error: "Unable to load market." }, { status: 500 });
  }
}
