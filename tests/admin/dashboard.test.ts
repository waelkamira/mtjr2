import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  countryFindFirst: vi.fn(),
  currencyFindFirst: vi.fn(),
  sellerFindUnique: vi.fn(),
  storeFindUnique: vi.fn(),
  userCount: vi.fn(),
  sellerCount: vi.fn(),
  storeCount: vi.fn(),
  productCount: vi.fn(),
  userFindMany: vi.fn(),
  sellerFindManyMetrics: vi.fn(),
  storeFindManyMetrics: vi.fn(),
  productFindMany: vi.fn(),
  orderGroupBy: vi.fn(),
  orderCount: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentGroupBy: vi.fn(),
  productReviewFindMany: vi.fn(),
  productReviewCount: vi.fn(),
  storeReviewFindMany: vi.fn(),
  storeReviewCount: vi.fn(),
  returnRequestFindMany: vi.fn(),
  returnRequestCount: vi.fn(),
  supportTicketFindMany: vi.fn(),
  supportTicketCount: vi.fn(),
  countryFindMany: vi.fn(),
  currencyFindMany: vi.fn(),
  sellerFindMany: vi.fn(),
  storeFindMany: vi.fn(),
  orderFindMany: vi.fn(),
  queryRaw: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    country: { findFirst: mocks.countryFindFirst, findMany: mocks.countryFindMany },
    currency: { findFirst: mocks.currencyFindFirst, findMany: mocks.currencyFindMany },
    seller: { count: mocks.sellerCount, findUnique: mocks.sellerFindUnique, findMany: (args: { where?: unknown }) => args.where ? mocks.sellerFindManyMetrics(args) : mocks.sellerFindMany(args) },
    store: { count: mocks.storeCount, findUnique: mocks.storeFindUnique, findMany: (args: { where?: unknown }) => args.where ? mocks.storeFindManyMetrics(args) : mocks.storeFindMany(args) },
    user: { count: mocks.userCount, findMany: mocks.userFindMany },
    product: { count: mocks.productCount, findMany: mocks.productFindMany },
    order: { groupBy: mocks.orderGroupBy, count: mocks.orderCount, findMany: mocks.orderFindMany },
    payment: { groupBy: mocks.paymentGroupBy, findMany: mocks.paymentFindMany },
    productReview: { count: mocks.productReviewCount, findMany: mocks.productReviewFindMany },
    storeReview: { count: mocks.storeReviewCount, findMany: mocks.storeReviewFindMany },
    returnRequest: { count: mocks.returnRequestCount, findMany: mocks.returnRequestFindMany },
    supportTicket: { count: mocks.supportTicketCount, findMany: mocks.supportTicketFindMany },
    $queryRaw: mocks.queryRaw
  }
}));

import { getAdminDashboard } from "@/server/admin/dashboard";

describe("admin dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.countryFindFirst.mockResolvedValue(null);
    mocks.currencyFindFirst.mockResolvedValue(null);
    mocks.sellerFindUnique.mockResolvedValue(null);
    mocks.storeFindUnique.mockResolvedValue(null);
    mocks.userCount.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
    mocks.sellerCount.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    mocks.storeCount.mockResolvedValueOnce(7).mockResolvedValueOnce(1);
    mocks.productCount.mockResolvedValueOnce(20).mockResolvedValueOnce(5);
    mocks.orderGroupBy
      .mockResolvedValueOnce([
        { status: "PENDING_PAYMENT", _count: { _all: 2 } },
        { status: "PROCESSING", _count: { _all: 3 } },
        { status: "COMPLETED", _count: { _all: 1 } },
        { status: "CANCELLED", _count: { _all: 1 } }
      ])
      .mockResolvedValueOnce([{ currencyCode: "USD", _sum: { totalMinor: BigInt(12500) } }]);
    mocks.orderCount.mockResolvedValue(8);
    mocks.paymentGroupBy
      .mockResolvedValueOnce([
        { status: "SUCCEEDED", _count: { _all: 4 } },
        { status: "FAILED", _count: { _all: 1 } },
        { status: "REQUIRES_ACTION", _count: { _all: 2 } }
      ])
      .mockResolvedValueOnce([{ currencyCode: "USD", _sum: { amountMinor: BigInt(9000) } }]);
    mocks.productReviewCount.mockResolvedValue(2);
    mocks.storeReviewCount.mockResolvedValue(1);
    mocks.returnRequestCount.mockResolvedValue(3);
    mocks.supportTicketCount.mockResolvedValue(6);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.sellerFindManyMetrics.mockResolvedValue([]);
    mocks.storeFindManyMetrics.mockResolvedValue([]);
    mocks.productFindMany.mockResolvedValue([]);
    mocks.paymentFindMany.mockResolvedValue([]);
    mocks.productReviewFindMany.mockResolvedValue([]);
    mocks.storeReviewFindMany.mockResolvedValue([]);
    mocks.returnRequestFindMany.mockResolvedValue([]);
    mocks.supportTicketFindMany.mockResolvedValue([]);
    mocks.countryFindMany.mockResolvedValue([]);
    mocks.currencyFindMany.mockResolvedValue([{ code: "USD", name: "US Dollar", minorUnit: 2 }]);
    mocks.sellerFindMany.mockResolvedValue([]);
    mocks.storeFindMany.mockResolvedValue([]);
    mocks.orderFindMany.mockResolvedValue([{
      id: "order-1",
      orderNumber: "MTJ-1",
      status: "PROCESSING",
      totalMinor: BigInt(2500),
      currencyCode: "USD",
      placedAt: new Date("2026-11-05T12:00:00.000Z")
    }]);
    mocks.queryRaw.mockResolvedValue([{ day: new Date("2026-11-05T00:00:00.000Z"), orderCount: 1 }]);
  });

  it("returns supported live counters without merging currency amounts", async () => {
    const result = await getAdminDashboard({ from: "2026-11-05", to: "2026-11-05" }, new Date("2026-11-05T15:00:00.000Z"));

    expect(mocks.requirePermission).toHaveBeenCalledWith({
      permissionKey: "users:manage",
      now: new Date("2026-11-05T15:00:00.000Z")
    });
    expect(result.metrics.totalOrders).toBe(7);
    expect(result.metrics.processingOrders).toBe(3);
    expect(result.metrics.grossOrderValueByCurrency).toEqual([{ currencyCode: "USD", amountMinor: "12500" }]);
    expect(result.metrics.successfulPaymentAmountByCurrency).toEqual([{ currencyCode: "USD", amountMinor: "9000" }]);
    expect(result.orderStatusCounts).toEqual([
      { status: "PENDING_PAYMENT", count: 2 },
      { status: "PROCESSING", count: 3 },
      { status: "COMPLETED", count: 1 },
      { status: "CANCELLED", count: 1 }
    ]);
    expect(result.dailyOrders).toEqual([{ day: "2026-11-05", count: 1 }]);
    expect(result.unavailableMetrics.marketplaceRevenue).toContain("No posted commission");
    expect(result.recentOrders[0].totalMinor).toBe("2500");
    expect(result.metricSamples.totalOrders).toEqual([{ label: "2026-11-05", value: 1 }]);
  });

  it("returns up to 20 real database samples for every metric card", async () => {
    const dates = Array.from({ length: 20 }, (_, index) => ({
      createdAt: new Date(Date.UTC(2026, 10, 5 - index))
    }));
    mocks.userFindMany.mockResolvedValue(dates);
    mocks.sellerFindManyMetrics.mockResolvedValue(dates);
    mocks.storeFindManyMetrics.mockResolvedValue(dates);
    mocks.productFindMany.mockResolvedValue(dates);
    mocks.paymentFindMany.mockResolvedValue(dates);
    mocks.productReviewFindMany.mockResolvedValue(dates);
    mocks.storeReviewFindMany.mockResolvedValue(dates);
    mocks.returnRequestFindMany.mockResolvedValue(dates.map(({ createdAt }) => ({ requestedAt: createdAt })));
    mocks.supportTicketFindMany.mockResolvedValue(dates);
    mocks.orderFindMany.mockResolvedValue(dates.map(({ createdAt }, index) => ({
      id: `order-${index}`,
      orderNumber: `MTJ-${index}`,
      status: "PROCESSING",
      totalMinor: BigInt(2500 + index),
      currencyCode: "USD",
      placedAt: createdAt
    })));

    const result = await getAdminDashboard({ from: "2026-10-17", to: "2026-11-05" }, new Date("2026-11-05T15:00:00.000Z"));

    expect(Object.values(result.metricSamples)).toHaveLength(20);
    expect(Object.values(result.metricSamples).every((samples) => samples.length === 20)).toBe(true);
    expect(result.metricSamples.grossOrderValue.every((sample) => sample.value > 0)).toBe(true);
  });

  it("rejects invalid and overlong date ranges before querying data", async () => {
    await expect(getAdminDashboard({ from: "2026-02-31", to: "2026-03-01" })).rejects.toThrow("valid calendar days");
    await expect(getAdminDashboard({ from: "2025-01-01", to: "2026-01-03" })).rejects.toThrow("up to 366 days");
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    expect(mocks.userCount).not.toHaveBeenCalled();
  });

  it("rejects a store that does not belong to the selected seller", async () => {
    mocks.sellerFindUnique.mockResolvedValue({ id: "seller-1" });
    mocks.storeFindUnique.mockResolvedValue({ id: "store-1", sellerId: "seller-2" });

    await expect(getAdminDashboard({ sellerId: "seller-1", storeId: "store-1" }))
      .rejects.toThrow("does not belong to that seller");
    expect(mocks.userCount).not.toHaveBeenCalled();
  });

  it("does not read dashboard data when the administrator lacks permission", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Permission denied."));

    await expect(getAdminDashboard({})).rejects.toThrow("Permission denied.");
    expect(mocks.userCount).not.toHaveBeenCalled();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });
});
