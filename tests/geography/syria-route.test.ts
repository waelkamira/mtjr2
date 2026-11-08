import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/geography/syria/route";
import geography from "@/data/geography/syria-v0.1.5.json";

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

  it("serves the pinned Syrian release with Arabic names and map centroids", async () => {
    const response = await GET(new Request("https://mtjr.test/api/geography/syria?level=localities&subdistrictId=sy-damascus-damascus-damascus&kind=city&q=دمشق"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toEqual([expect.objectContaining({
      id: "sy-damascus-damascus-damascus-damascus",
      name: "دمشق",
      englishName: "Damascus",
      kind: "city",
      coordinates: { latitude: 33.517175, longitude: 36.27671 }
    })]);
    expect(body.sourceVersion).toBe("v0.1.5");
    expect(body.license).toBe("CC BY 4.0");
  });

  it("bundles the complete pinned source release", () => {
    expect(geography.governorates).toHaveLength(14);
    expect(geography.districts).toHaveLength(62);
    expect(geography.subdistricts).toHaveLength(272);
    expect(geography.localities).toHaveLength(7605);
  });

  it("exposes all Syrian administrative levels with stable counts and pagination", async () => {
    const [governoratesResponse, districtsResponse, subdistrictsResponse, localitiesResponse] = await Promise.all([
      GET(new Request("https://mtjr.test/api/geography/syria?level=governorates")),
      GET(new Request("https://mtjr.test/api/geography/syria?level=districts&governorateId=sy-damascus")),
      GET(new Request("https://mtjr.test/api/geography/syria?level=subdistricts&districtId=sy-damascus-damascus")),
      GET(new Request("https://mtjr.test/api/geography/syria?level=localities&governorateId=sy-damascus"))
    ]);
    const [governorates, districts, subdistricts, localities] = await Promise.all([
      governoratesResponse.json(), districtsResponse.json(), subdistrictsResponse.json(), localitiesResponse.json()
    ]);
    expect(governorates.pagination.totalRecords).toBe(14);
    expect(districts.pagination.totalRecords).toBeGreaterThan(0);
    expect(subdistricts.pagination.totalRecords).toBeGreaterThan(0);
    expect(localities.pagination.totalRecords).toBeGreaterThan(50);
    expect(localities.pagination.totalPages).toBeGreaterThan(1);
    expect(localities.items).toHaveLength(50);
  });
});
