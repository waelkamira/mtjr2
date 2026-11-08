import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ localityId: string }> }
): Promise<Response> {
  try {
    const { localityId } = await context.params;
    const id = z.string().trim().min(1).max(128).parse(localityId);
    const item = await prisma.syriaLocality.findUnique({
      where: { id },
      select: {
        id: true, nameAr: true, nameEn: true, kind: true,
        governorateId: true, districtId: true, subdistrictId: true,
        latitude: true, longitude: true,
        governorate: { select: { nameAr: true, nameEn: true } },
        district: { select: { id: true, nameAr: true, nameEn: true } },
        subdistrict: { select: { id: true, nameAr: true, nameEn: true } }
      }
    });
    if (!item) return Response.json({ error: "Locality not found." }, { status: 404 });
    return Response.json({ item }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid locality ID." }, { status: 400 });
    return Response.json({ error: "Unable to load locality details." }, { status: 503 });
  }
}
