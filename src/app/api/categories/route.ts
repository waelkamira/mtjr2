import { NextRequest } from "next/server";
import { z } from "zod";
import { listActiveCategoryTree } from "@/server/catalog/taxonomy";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/locale";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const requestedLocale = request.nextUrl.searchParams.get("locale") ?? request.cookies.get(localeCookieName)?.value;
    const result = await listActiveCategoryTree({
      locale: isLocale(requestedLocale) ? requestedLocale : defaultLocale,
      page: request.nextUrl.searchParams.get("page") ?? "1",
      limit: request.nextUrl.searchParams.get("limit") ?? "30",
      includeEmpty: request.nextUrl.searchParams.get("includeEmpty") ?? "false"
    });
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid category query." }, { status: 400 });
    return Response.json({ error: "Unable to load categories." }, { status: 500 });
  }
}
