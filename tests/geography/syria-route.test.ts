import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/geography/syria/route";

describe("Syrian geography API route", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects unsupported levels before calling the upstream service", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await GET(new Request("https://mtjr.test/api/geography/syria?level=neighborhoods"));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("requires a parent identifier for district and subdistrict lists", async () => {
    const districtResponse = await GET(new Request("https://mtjr.test/api/geography/syria?level=districts"));
    const subdistrictResponse = await GET(new Request("https://mtjr.test/api/geography/syria?level=subdistricts"));
    expect(districtResponse.status).toBe(400);
    expect(subdistrictResponse.status).toBe(400);
  });

  it("normalizes source-backed Arabic names and centroids", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        items: [{
          id: "sy-damascus",
          name: { ar: "دمشق", en: "Damascus" },
          kind: "city",
          governorateId: "sy-damascus",
          districtId: "sy-damascus-damascus",
          subdistrictId: "sy-damascus-damascus-damascus",
          centroid: { latitude: 33.5138, longitude: 36.2765 }
        }],
        pagination: { currentPage: 1, totalPages: 1 }
      }
    }), { status: 200 })));
    const response = await GET(new Request("https://mtjr.test/api/geography/syria?level=localities&subdistrictId=sy-damascus-damascus-damascus"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toEqual([expect.objectContaining({
      id: "sy-damascus",
      name: "دمشق",
      englishName: "Damascus",
      kind: "city",
      coordinates: { latitude: 33.5138, longitude: 36.2765 }
    })]);
    expect(body.sourceVersion).toBe("v0.1.5");
  });

  it("does not expose upstream errors or response bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream failure details", { status: 429 })));
    const response = await GET(new Request("https://mtjr.test/api/geography/syria"));
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.error).toContain("temporarily unavailable");
    expect(JSON.stringify(body)).not.toContain("upstream failure details");
  });
});
