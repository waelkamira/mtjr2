import { NextResponse } from "next/server";
import geography from "@/data/geography/syria-v0.1.5.json";

export const runtime = "nodejs";
export const revalidate = 86_400;

type GeographyLevel = "governorates" | "districts" | "subdistricts" | "localities";
type GeographyRecord = {
  id: string;
  governorateId?: string;
  districtId?: string;
  subdistrictId?: string;
  kind?: "city" | "town" | "village" | "locality";
  name: { ar?: string; en: string };
  centroid: { latitude: number; longitude: number } | null;
};

const levels = new Set<GeographyLevel>(["governorates", "districts", "subdistricts", "localities"]);
const idPattern = /^sy-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pageSize = 50;

function normalizeSearch(value: string) {
  return value.normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .trim()
    .toLocaleLowerCase("ar");
}

function getRecords(level: GeographyLevel): GeographyRecord[] {
  return geography[level] as GeographyRecord[];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const levelValue = params.get("level") ?? "governorates";
  if (!levels.has(levelValue as GeographyLevel)) {
    return NextResponse.json({ error: "Invalid geography level." }, { status: 400 });
  }
  const level = levelValue as GeographyLevel;
  const page = Number(params.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    return NextResponse.json({ error: "Invalid page." }, { status: 400 });
  }

  const governorateId = params.get("governorateId") ?? "";
  const districtId = params.get("districtId") ?? "";
  const subdistrictId = params.get("subdistrictId") ?? "";
  const kind = params.get("kind") ?? "";
  const query = normalizeSearch((params.get("q") ?? "").slice(0, 80));

  for (const id of [governorateId, districtId, subdistrictId]) {
    if (id && !idPattern.test(id)) {
      return NextResponse.json({ error: "Invalid geography parent ID." }, { status: 400 });
    }
  }
  if (level === "districts" && !governorateId) {
    return NextResponse.json({ error: "Governorate is required." }, { status: 400 });
  }
  if (level === "subdistricts" && !districtId) {
    return NextResponse.json({ error: "District is required." }, { status: 400 });
  }
  if (level === "localities" && !governorateId && !districtId && !subdistrictId) {
    return NextResponse.json({ error: "Choose an administrative area before loading localities." }, { status: 400 });
  }
  if (kind && (level !== "localities" || !["city", "town", "village", "locality"].includes(kind))) {
    return NextResponse.json({ error: "Invalid locality kind." }, { status: 400 });
  }

  let records = getRecords(level);
  if (governorateId) records = records.filter((record) => record.governorateId === governorateId || (level === "governorates" && record.id === governorateId));
  if (districtId) records = records.filter((record) => record.districtId === districtId || (level === "districts" && record.id === districtId));
  if (subdistrictId) records = records.filter((record) => record.subdistrictId === subdistrictId || (level === "subdistricts" && record.id === subdistrictId));
  if (kind) records = records.filter((record) => record.kind === kind);
  if (query) {
    records = records.filter((record) => {
      const arabic = normalizeSearch(record.name.ar ?? "");
      const english = normalizeSearch(record.name.en);
      return arabic.includes(query) || english.includes(query);
    });
  }

  records = [...records].sort((left, right) =>
    (left.name.ar ?? left.name.en).localeCompare(right.name.ar ?? right.name.en, "ar")
  );
  const totalRecords = records.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const items = records.slice((page - 1) * pageSize, page * pageSize).map((record) => ({
    id: record.id,
    name: record.name.ar ?? record.name.en,
    englishName: record.name.en,
    kind: record.kind ?? level.slice(0, -1),
    governorateId: record.governorateId ?? null,
    districtId: record.districtId ?? null,
    subdistrictId: record.subdistrictId ?? null,
    coordinates: record.centroid
  }));

  return NextResponse.json({
    items,
    pagination: {
      limit: pageSize,
      currentPage: page,
      pageRecords: items.length,
      totalRecords,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null
    },
    source: geography.source,
    sourceVersion: geography.version,
    license: geography.license
  }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
  });
}
