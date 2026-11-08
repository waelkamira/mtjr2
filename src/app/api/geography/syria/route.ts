import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 21_600;

const API_BASE = "https://api.opensyria.org/api/v1/geography";
const levels = new Set(["governorates", "districts", "subdistricts", "localities"]);
const idPattern = /^sy-[a-z0-9]+(?:-[a-z0-9]+)*$/;

type LocalizedName = string | { ar?: string; en?: string };
type RawRecord = {
  id?: string;
  name?: LocalizedName;
  kind?: string;
  governorateId?: string;
  districtId?: string;
  subdistrictId?: string;
  centroid?: { latitude?: number; longitude?: number } | null;
};

function extractItems(payload: unknown): RawRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null;
  const candidates = [data?.items, root.items, data?.records, root.records];
  return candidates.find(Array.isArray) as RawRecord[] | undefined ?? [];
}

function normalizeName(value: LocalizedName | undefined) {
  if (typeof value === "string") return { ar: value, en: value };
  return { ar: value?.ar ?? value?.en ?? "", en: value?.en ?? value?.ar ?? "" };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level") ?? "governorates";
  if (!levels.has(level)) return NextResponse.json({ error: "Invalid geography level." }, { status: 400 });

  const pageValue = Number(params.get("page") ?? "1");
  if (!Number.isInteger(pageValue) || pageValue < 1 || pageValue > 200) {
    return NextResponse.json({ error: "Invalid page." }, { status: 400 });
  }

  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const governorateId = params.get("governorateId") ?? "";
  const districtId = params.get("districtId") ?? "";
  const subdistrictId = params.get("subdistrictId") ?? "";
  for (const id of [governorateId, districtId, subdistrictId]) {
    if (id && !idPattern.test(id)) return NextResponse.json({ error: "Invalid geography parent ID." }, { status: 400 });
  }

  if (level === "districts" && !governorateId) return NextResponse.json({ error: "Governorate is required." }, { status: 400 });
  if (level === "subdistricts" && !districtId) return NextResponse.json({ error: "District is required." }, { status: 400 });
  if (level === "localities" && !governorateId && !subdistrictId) {
    return NextResponse.json({ error: "Choose a governorate or subdistrict before loading localities." }, { status: 400 });
  }

  const upstream = new URL(`${API_BASE}/${level}`);
  upstream.searchParams.set("page", String(pageValue));
  upstream.searchParams.set("limit", "fifty");
  upstream.searchParams.set("order", "asc");
  upstream.searchParams.set("sourceStatus", "released");
  if (query.length >= 2) upstream.searchParams.set("q", query);
  if (governorateId) upstream.searchParams.set("governorateId", governorateId);
  if (districtId) upstream.searchParams.set("districtId", districtId);
  if (subdistrictId) upstream.searchParams.set("subdistrictId", subdistrictId);

  try {
    const response = await fetch(upstream, {
      headers: { Accept: "application/json", "X-Lang": "ar" },
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Syrian geography data is temporarily unavailable." }, { status: 502 });
    }
    const payload: unknown = await response.json();
    const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
    const items = extractItems(payload).map((record) => {
      const name = normalizeName(record.name);
      const latitude = record.centroid?.latitude;
      const longitude = record.centroid?.longitude;
      return {
        id: record.id ?? "",
        name: name.ar,
        englishName: name.en,
        kind: record.kind ?? level.slice(0, -1),
        governorateId: record.governorateId ?? null,
        districtId: record.districtId ?? null,
        subdistrictId: record.subdistrictId ?? null,
        coordinates: Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { latitude, longitude }
          : null,
      };
    }).filter((record) => record.id && record.name);

    return NextResponse.json({
      items,
      pagination: data.pagination ?? null,
      source: "OpenSyria Data Geography",
      sourceVersion: "v0.1.5",
    }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve Syrian geography data." }, { status: 502 });
  }
}
