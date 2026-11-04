import { z } from "zod";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import { enforcePublicSearchBudget } from "@/server/search/search-request";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rejected = await enforcePublicSearchBudget(request);
  if (rejected) return rejected;
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = await listDiscoverableProducts(params);
    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid search query.", issues: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Search results are temporarily unavailable." }, { status: 500 });
  }
}
