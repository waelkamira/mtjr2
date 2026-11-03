import { NextRequest } from "next/server";
import { listActiveBrands } from "@/server/catalog/taxonomy";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const params = request.nextUrl.searchParams;
    const result = await listActiveBrands({
      locale: params.get("locale") ?? "en",
      page: params.get("page") ?? "1",
      limit: params.get("limit") ?? "30"
    });
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return Response.json({ error: "Invalid brand query." }, { status: 400 });
  }
}
