import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { syriaLocality: { findUnique: mocks.findUnique } }
}));

import { GET } from "@/app/api/geography/localities/[localityId]/route";

describe("GET /api/geography/localities/:localityId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the locality and its administrative hierarchy for edit-form hydration", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "sy-locality-1",
      nameAr: "المزة",
      nameEn: "Al Mazzeh",
      kind: "suburb",
      governorateId: "sy-damascus",
      districtId: "sy-damascus-district",
      subdistrictId: "sy-mazzeh",
      latitude: 33.505,
      longitude: 36.278,
      governorate: { nameAr: "دمشق", nameEn: "Damascus" },
      district: { id: "sy-damascus-district", nameAr: "دمشق", nameEn: "Damascus" },
      subdistrict: { id: "sy-mazzeh", nameAr: "المزة", nameEn: "Al Mazzeh" }
    });

    const response = await GET(new Request("https://matjar.test/api/geography/localities/sy-locality-1"), {
      params: Promise.resolve({ localityId: "sy-locality-1" })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      item: { id: "sy-locality-1", governorateId: "sy-damascus", districtId: "sy-damascus-district", subdistrictId: "sy-mazzeh" }
    });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sy-locality-1" },
      select: expect.objectContaining({ governorate: expect.any(Object), district: expect.any(Object), subdistrict: expect.any(Object) })
    }));
  });

  it("returns 404 when the locality does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await GET(new Request("https://matjar.test/api/geography/localities/missing"), {
      params: Promise.resolve({ localityId: "missing" })
    });
    expect(response.status).toBe(404);
  });
});
