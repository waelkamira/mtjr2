import { NextRequest } from "next/server";
import { z } from "zod";
import { listActiveBrands } from "@/server/catalog/taxonomy";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/locale";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const params = request.nextUrl.searchParams;
    const requestedLocale = params.get("locale") ?? request.cookies.get(localeCookieName)?.value;
    const result = await listActiveBrands({
      locale: isLocale(requestedLocale) ? requestedLocale : defaultLocale,
      page: params.get("page") ?? "1",
      limit: params.get("limit") ?? "30"
    });
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid brand query." }, { status: 400 });
    return Response.json({ error: "Unable to load brands." }, { status: 500 });
  }
}
