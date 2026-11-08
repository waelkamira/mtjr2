import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/locale";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
): Promise<Response> {
  try {
    const { categoryId } = await context.params;
    const parsedId = z.string().trim().min(1).max(128).parse(categoryId);
    const requestedLocale = request.nextUrl.searchParams.get("locale") ?? request.cookies.get(localeCookieName)?.value;
    const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
    const category = await prisma.category.findFirst({
      where: { id: parsedId, status: "ACTIVE" },
      select: { id: true }
    });
    if (!category) return Response.json({ error: "Category is unavailable." }, { status: 404 });
    const rows = await prisma.categoryAttribute.findMany({
      where: { categoryId: parsedId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true, attributeDefinitionId: true, isRequired: true, isVariantLevel: true, options: true,
        attribute: {
          select: {
            key: true, valueType: true,
            translations: { where: { locale }, select: { name: true, description: true }, take: 1 }
          }
        }
      }
    });
    return Response.json({
      categoryId: category.id,
      items: rows.map((row) => ({
        id: row.attributeDefinitionId,
        key: row.attribute.key,
        label: row.attribute.translations[0]?.name ?? row.attribute.key,
        description: row.attribute.translations[0]?.description ?? null,
        valueType: row.attribute.valueType,
        required: row.isRequired,
        variantLevel: row.isVariantLevel,
        options: Array.isArray(row.options) ? row.options.filter((value): value is string => typeof value === "string") : []
      }))
    }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid category." }, { status: 400 });
    return Response.json({ error: "Unable to load category attributes." }, { status: 500 });
  }
}
