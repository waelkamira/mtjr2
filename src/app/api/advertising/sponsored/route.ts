import { z } from "zod";
import { listSponsoredCampaigns } from "@/server/advertising/delivery";
import { enforcePublicSearchBudget } from "@/server/search/search-request";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  const rejected = await enforcePublicSearchBudget(request);
  if (rejected) return rejected;
  const params = new URL(request.url).searchParams;
  const parsed = z.object({
    marketId: z.string().trim().min(1).max(80),
    q: z.string().trim().max(120).optional(),
    categoryIds: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    brandId: z.string().trim().min(1).max(80).optional()
  }).strict().safeParse({
    marketId: params.get("marketId"),
    q: params.get("q") ?? undefined,
    categoryIds: [...new Set([...params.getAll("categoryId"), ...(params.get("categoryIds") ?? "").split(",")].map((value) => value.trim()).filter(Boolean))].slice(0, 20),
    brandId: params.get("brandId") ?? undefined
  });
  if (!parsed.success) return Response.json({ error: "A valid market is required." }, { status: 400 });
  try {
    const items = await listSponsoredCampaigns({ marketId: parsed.data.marketId, categoryIds: parsed.data.categoryIds, brandId: parsed.data.brandId, query: parsed.data.q, limit: 4 });
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Sponsored products are temporarily unavailable." }, { status: 500 });
  }
}
