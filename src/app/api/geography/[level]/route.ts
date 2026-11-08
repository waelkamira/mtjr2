import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const querySchema = z.object({
  governorateId: z.string().trim().min(1).max(100).optional(),
  districtId: z.string().trim().min(1).max(100).optional(),
  subdistrictId: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100)
}).strict();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ level: string }> }
): Promise<Response> {
  try {
    const { level } = await context.params;
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const skip = (query.page - 1) * query.limit;
    const nameFilter = query.q ? {
      OR: [
        { nameAr: { contains: query.q, mode: "insensitive" as const } },
        { nameEn: { contains: query.q, mode: "insensitive" as const } }
      ]
    } : {};
    let items;
    let total = 0;

    if (level === "governorates") {
      const where = nameFilter;
      [items, total] = await Promise.all([
        prisma.syriaGovernorate.findMany({ where, orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }], skip, take: query.limit, select: { id: true, nameAr: true, nameEn: true, latitude: true, longitude: true } }),
        prisma.syriaGovernorate.count({ where })
      ]);
    } else if (level === "districts") {
      if (!query.governorateId) return Response.json({ error: "governorateId is required." }, { status: 400 });
      const where = { governorateId: query.governorateId, ...nameFilter };
      [items, total] = await Promise.all([
        prisma.syriaDistrict.findMany({ where, orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }], skip, take: query.limit, select: { id: true, governorateId: true, nameAr: true, nameEn: true, latitude: true, longitude: true } }),
        prisma.syriaDistrict.count({ where })
      ]);
    } else if (level === "subdistricts") {
      if (!query.districtId) return Response.json({ error: "districtId is required." }, { status: 400 });
      const where = { districtId: query.districtId, ...nameFilter };
      [items, total] = await Promise.all([
        prisma.syriaSubdistrict.findMany({ where, orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }], skip, take: query.limit, select: { id: true, governorateId: true, districtId: true, nameAr: true, nameEn: true, latitude: true, longitude: true } }),
        prisma.syriaSubdistrict.count({ where })
      ]);
    } else if (level === "localities") {
      if (!query.subdistrictId) return Response.json({ error: "subdistrictId is required." }, { status: 400 });
      const where = { subdistrictId: query.subdistrictId, ...nameFilter };
      [items, total] = await Promise.all([
        prisma.syriaLocality.findMany({ where, orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }], skip, take: query.limit, select: { id: true, governorateId: true, districtId: true, subdistrictId: true, nameAr: true, nameEn: true, kind: true, latitude: true, longitude: true } }),
        prisma.syriaLocality.count({ where })
      ]);
    } else {
      return Response.json({ error: "Unknown geography level." }, { status: 404 });
    }

    return Response.json({ items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid geography query." }, { status: 400 });
    return Response.json({ error: "Unable to load Syrian geography. Ensure the pinned geography seed has been imported." }, { status: 503 });
  }
}
