import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters to search." }, { status: 400 });
  }
  if (query.length > 100) {
    return NextResponse.json({ error: "Search query is too long." }, { status: 400 });
  }

  try {
    const contains = { contains: query, mode: "insensitive" as const };
    const nameFilter = { OR: [{ nameAr: contains }, { nameEn: contains }] };
    const [localities, subdistricts, districts, governorates] = await Promise.all([
      prisma.syriaLocality.findMany({
        where: { ...nameFilter, latitude: { not: null }, longitude: { not: null } },
        orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }],
        take: 10,
        select: { id: true, nameAr: true, nameEn: true, kind: true, latitude: true, longitude: true, district: { select: { nameAr: true, nameEn: true } }, governorate: { select: { nameAr: true, nameEn: true } } }
      }),
      prisma.syriaSubdistrict.findMany({
        where: { ...nameFilter, latitude: { not: null }, longitude: { not: null } },
        orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }],
        take: 5,
        select: { id: true, nameAr: true, nameEn: true, latitude: true, longitude: true, district: { select: { nameAr: true, nameEn: true } }, governorate: { select: { nameAr: true, nameEn: true } } }
      }),
      prisma.syriaDistrict.findMany({
        where: { ...nameFilter, latitude: { not: null }, longitude: { not: null } },
        orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }],
        take: 5,
        select: { id: true, nameAr: true, nameEn: true, latitude: true, longitude: true, governorate: { select: { nameAr: true, nameEn: true } } }
      }),
      prisma.syriaGovernorate.findMany({
        where: { ...nameFilter, latitude: { not: null }, longitude: { not: null } },
        orderBy: [{ nameAr: "asc" }, { nameEn: "asc" }],
        take: 3,
        select: { id: true, nameAr: true, nameEn: true, latitude: true, longitude: true }
      })
    ]);

    const items = [
      ...localities.map((item) => ({
        id: `locality:${item.id}`,
        label: [item.nameAr || item.nameEn, item.district?.nameAr || item.district?.nameEn, item.governorate.nameAr || item.governorate.nameEn].filter(Boolean).join(" — "),
        latitude: item.latitude!, longitude: item.longitude!, type: item.kind
      })),
      ...subdistricts.map((item) => ({
        id: `subdistrict:${item.id}`,
        label: [item.nameAr || item.nameEn, item.district.nameAr || item.district.nameEn, item.governorate.nameAr || item.governorate.nameEn].filter(Boolean).join(" — "),
        latitude: item.latitude!, longitude: item.longitude!, type: "subdistrict"
      })),
      ...districts.map((item) => ({
        id: `district:${item.id}`,
        label: [item.nameAr || item.nameEn, item.governorate.nameAr || item.governorate.nameEn].filter(Boolean).join(" — "),
        latitude: item.latitude!, longitude: item.longitude!, type: "district"
      })),
      ...governorates.map((item) => ({
        id: `governorate:${item.id}`, label: item.nameAr || item.nameEn,
        latitude: item.latitude!, longitude: item.longitude!, type: "governorate"
      }))
    ].slice(0, 10);

    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ error: "OpenSyria geography search is temporarily unavailable. Ensure the official dataset is imported." }, { status: 503 });
  }
}
