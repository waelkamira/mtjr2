import { NextRequest } from "next/server";
import { z } from "zod";
import { listActiveCategoryTree } from "@/server/catalog/taxonomy";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const result = await listActiveCategoryTree({
      locale: request.nextUrl.searchParams.get("locale") ?? "en",
      page: request.nextUrl.searchParams.get("page") ?? "1",
      limit: request.nextUrl.searchParams.get("limit") ?? "30"
    });
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid category query." }, { status: 400 });
    return Response.json({ error: "Unable to load categories." }, { status: 500 });
  }
}
