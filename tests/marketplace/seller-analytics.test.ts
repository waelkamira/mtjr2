import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasPermission: vi.fn(),
  userHasScopedPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  sellerStaffFindFirst: vi.fn(),
  vendorOrderCount: vi.fn(),
  vendorOrderGroupBy: vi.fn(),
  queryRaw: vi.fn(),
  orderItemGroupBy: vi.fn(),
  productCount: vi.fn(),
  storeReviewAggregate: vi.fn(),
  returnRequestCount: vi.fn(),
  currencyFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("@/server/identity/access-errors", () => ({
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: mocks.userHasPermission,
  userHasScopedPermission: mocks.userHasScopedPermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    store: { findUnique: mocks.storeFindUnique },
    sellerStaff: { findFirst: mocks.sellerStaffFindFirst },
    vendorOrder: { count: mocks.vendorOrderCount, groupBy: mocks.vendorOrderGroupBy },
    $queryRaw: mocks.queryRaw,
    orderItem: { groupBy: mocks.orderItemGroupBy },
    product: { count: mocks.productCount },
    storeReview: { aggregate: mocks.storeReviewAggregate },
    returnRequest: { count: mocks.returnRequestCount },
    currency: { findMany: mocks.currencyFindMany }
  }
}));

import { getSellerDashboardAnalytics } from "@/server/marketplace/seller-analytics";
import { PermissionDeniedError } from "@/server/identity/access-errors";

describe("seller dashboard analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", name: "Studio Store", status: "ACTIVE", seller: { ownerId: "seller-1", status: "ACTIVE" }
    });
    mocks.sellerStaffFindFirst.mockResolvedValue(null);
    mocks.vendorOrderCount.mockResolvedValue(2);
    mocks.vendorOrderGroupBy.mockResolvedValue([{ status: "CONFIRMED", _count: { _all: 2 } }]);
    mocks.queryRaw
      .mockResolvedValueOnce([{ currencyCode: "EUR", amountMinor: BigInt(12345), orderCount: BigInt(2) }])
      .mockResolvedValueOnce([{ day: new Date("2026-11-07T00:00:00.000Z"), currencyCode: "EUR", amountMinor: BigInt(12345), orderCount: BigInt(2) }]);
    mocks.orderItemGroupBy.mockResolvedValue([{ productId: "product-1", productName: "Linen Shirt", _sum: { quantity: 3 } }]);
    mocks.productCount.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
    mocks.storeReviewAggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } });
    mocks.returnRequestCount.mockResolvedValue(1);
    mocks.currencyFindMany.mockResolvedValue([{ code: "EUR", name: "Euro", minorUnit: 2, symbol: "€" }]);
  });

  it("returns real store-scoped metrics without combining different currencies", async () => {
    const result = await getSellerDashboardAnalytics({ storeId: "store-1", from: "2026-11-01", to: "2026-11-30" });
    expect(result.store).toEqual({ id: "store-1", name: "Studio Store" });
    expect(result.metrics.totalOrders).toBe(2);
    expect(result.metrics.grossSalesByCurrency).toEqual([{
      currencyCode: "EUR", amountMinor: "12345", orderCount: 2, minorUnit: 2, currencyName: "Euro"
    }]);
    expect(result.metrics.activeProducts).toBe(8);
    expect(result.metrics.pendingProducts).toBe(2);
    expect(result.metrics.averageRating).toBe(4.5);
    expect(result.metrics.requestedReturns).toBe(1);
    expect(result.topProducts).toEqual([{ productId: "product-1", name: "Linen Shirt", unitsSold: 3 }]);
    expect(result.dailySales[0]?.currencyCode).toBe("EUR");
  });

  it("denies users who are neither the store owner nor active scoped staff", async () => {
    mocks.storeFindUnique.mockResolvedValueOnce({
      id: "store-1", name: "Studio Store", status: "ACTIVE", seller: { ownerId: "another-seller", status: "ACTIVE" }
    });
    await expect(getSellerDashboardAnalytics({ storeId: "store-1" })).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(mocks.vendorOrderCount).not.toHaveBeenCalled();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns only the analytics sections granted to an active staff member", async () => {
    mocks.storeFindUnique.mockResolvedValueOnce({
      id: "store-1", name: "Studio Store", status: "ACTIVE", seller: { ownerId: "another-seller", status: "ACTIVE" }
    });
    mocks.sellerStaffFindFirst.mockResolvedValueOnce({ id: "staff-1" });
    mocks.userHasScopedPermission.mockImplementation(async (_userId: string, args: { permissionKey: string }) => args.permissionKey === "orders:read");

    const result = await getSellerDashboardAnalytics({ storeId: "store-1" });
    expect(result.permissions.orders).toBe(true);
    expect(result.permissions.catalog).toBe(false);
    expect(result.metrics.activeProducts).toBeNull();
    expect(result.metrics.averageRating).toBeNull();
    expect(result.metrics.requestedReturns).toBeNull();
    expect(mocks.productCount).not.toHaveBeenCalled();
    expect(mocks.storeReviewAggregate).not.toHaveBeenCalled();
    expect(mocks.returnRequestCount).not.toHaveBeenCalled();
  });
});
