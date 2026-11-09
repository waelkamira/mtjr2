import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const locale = request.nextUrl.searchParams.get("locale") === "ar" ? "ar" : "en";

  if (query.length < 3) {
    return NextResponse.json({ error: "Enter at least 3 characters to search." }, { status: 400 });
  }
  if (query.length > 160) {
    return NextResponse.json({ error: "Search query is too long." }, { status: 400 });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "7");
    url.searchParams.set("accept-language", locale);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Matjar Marketplace location picker (https://github.com/waelkamira/mtjr2)",
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "The map search service is temporarily unavailable." }, { status: 502 });
    }
    const results = await response.json() as NominatimResult[];
    const items = results.flatMap((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
      return [{
        id: String(item.place_id),
        label: item.display_name,
        latitude,
        longitude,
        type: item.type ?? item.class ?? "",
      }];
    });
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "The map search service could not be reached. Please try again." }, { status: 503 });
  }
}
