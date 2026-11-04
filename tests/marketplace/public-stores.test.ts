import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storeFindMany: vi.fn(),
  storeCount: vi.fn(),
  storeFindFirst: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { store: { findMany: mocks.storeFindMany, count: mocks.storeCount, findFirst: mocks.storeFindFirst } }
}));

import { getDiscoverableStoreBySlug, listDiscoverableStores } from "@/server/marketplace/public-stores";

describe("public store discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storeFindMany.mockResolvedValue([{
      id: "store-1",
      slug: "northstar",
      name: "Northstar Goods",
      seller: { displayName: "Northstar Seller" },
      _count: { products: 3 }
    }]);
    mocks.storeCount.mockResolvedValue(1);
    mocks.storeFindFirst.mockResolvedValue({
      id: "store-1",
      slug: "northstar",
      name: "Northstar Goods",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      seller: { displayName: "Northstar Seller" },
      _count: { products: 3 }
    });
  });

  it("lists only active stores with active sellers and exposes their public display name", async () => {
    const result = await listDiscoverableStores({ q: "northstar" });
    const where = mocks.storeFindMany.mock.calls[0][0].where;

    expect(where).toMatchObject({ status: "ACTIVE", seller: { status: "ACTIVE" } });
    expect(where.OR).toContainEqual({
      seller: { displayName: { contains: "northstar", mode: "insensitive" } }
    });
    expect(result.items[0]).toMatchObject({
      id: "store-1",
      name: "Northstar Goods",
      sellerDisplayName: "Northstar Seller",
      productCount: 3
    });
  });

  it("returns public seller data for an active store detail page", async () => {
    const result = await getDiscoverableStoreBySlug("northstar");

    expect(mocks.storeFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "northstar", status: "ACTIVE", seller: { status: "ACTIVE" } }
    }));
    expect(result).toMatchObject({
      name: "Northstar Goods",
      sellerDisplayName: "Northstar Seller",
      productCount: 3
    });
  });
});
