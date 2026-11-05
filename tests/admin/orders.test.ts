import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: {
      count: mocks.orderCount,
      findMany: mocks.orderFindMany,
      findUnique: mocks.orderFindUnique
    }
  }
}));

import { getAdminOrder, listAdminOrders } from "@/server/admin/orders";

describe("admin order inspection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.orderCount.mockResolvedValue(1);
    mocks.orderFindMany.mockResolvedValue([{
      id: "order-1",
      orderNumber: "MTJ-1",
      status: "PENDING_PAYMENT",
      currencyCode: "USD",
      currency: { minorUnit: 2 },
      totalMinor: BigInt(1234),
      placedAt: new Date("2026-11-05T12:00:00.000Z"),
      user: { id: "buyer-1", email: "buyer@example.test", displayName: "Buyer" },
      _count: { vendorOrders: 2, payments: 0 }
    }]);
  });

  it("searches and paginates order data behind the admin permission", async () => {
    const result = await listAdminOrders({ q: "MTJ", status: "PENDING_PAYMENT", page: "2", limit: "10" });

    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage", now: expect.any(Date) });
    expect(mocks.orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      orderBy: [{ placedAt: "desc" }, { id: "desc" }],
      where: expect.objectContaining({ status: "PENDING_PAYMENT" })
    }));
    expect(result).toMatchObject({ page: 2, limit: 10, total: 1, pageCount: 1 });
    expect(result.items[0]).toMatchObject({ totalMinor: "1234", vendorOrderCount: 2, paymentCount: 0 });
  });

  it("serializes the detailed immutable order snapshot without payment secrets", async () => {
    const date = new Date("2026-11-05T12:00:00.000Z");
    mocks.orderFindUnique.mockResolvedValue({
      id: "order-1", orderNumber: "MTJ-1", status: "PENDING_PAYMENT", currencyCode: "USD",
      currency: { minorUnit: 2 }, subtotalMinor: BigInt(1000), couponCode: null,
      discountMinor: BigInt(0), shippingMinor: BigInt(100), taxMinor: BigInt(134),
      taxRuleName: "Local tax", taxRateBasisPoints: 1340, taxInclusive: false,
      taxIncludesShipping: true, taxDestinationRegion: "CA", totalMinor: BigInt(1234),
      placedAt: date, createdAt: date, user: null, address: null,
      statusHistory: [{ status: "PENDING_PAYMENT", note: null, createdAt: date }],
      payments: [{
        id: "payment-1", provider: "test", status: "INITIATING", amountMinor: BigInt(1234),
        currencyCode: "USD", currency: { minorUnit: 2 }, createdAt: date, succeededAt: null
      }],
      vendorOrders: [{
        id: "vendor-order-1", status: "PENDING_PAYMENT", subtotalMinor: BigInt(1000),
        discountMinor: BigInt(0), shippingMinor: BigInt(100), taxMinor: BigInt(134),
        taxInclusive: false, shippingServiceName: "Standard", shippingDestinationRegion: "CA",
        minDeliveryDays: 2, maxDeliveryDays: 5, totalMinor: BigInt(1234), createdAt: date,
        store: { id: "store-1", name: "Store", slug: "store", seller: { id: "seller-1", displayName: "Seller", legalName: null } },
        items: [{
          id: "item-1", productName: "Item", sku: "SKU-1", variantName: null,
          quantity: 1, unitAmountMinor: BigInt(1000), lineTotalMinor: BigInt(1000)
        }],
        statusHistory: [],
        shipment: {
          carrierName: "Carrier", trackingNumber: "TRACK-1", trackingUrl: null,
          status: "SHIPPED", shippedAt: date, deliveredAt: null, events: []
        }
      }]
    });

    const result = await getAdminOrder("order-1");

    expect(result.totalMinor).toBe("1234");
    expect(result.payments[0].amountMinor).toBe("1234");
    expect(result.vendorOrders[0].items[0].lineTotalMinor).toBe("1000");
    expect(result.vendorOrders[0].shipment?.shippedAt).toBe(date.toISOString());
    const select = mocks.orderFindUnique.mock.calls[0][0].select;
    expect(select.payments.select).not.toHaveProperty("providerReference");
    expect(select.payments.select).not.toHaveProperty("checkoutUrl");
  });

  it("does not read orders when permission is denied", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Permission denied."));

    await expect(listAdminOrders({})).rejects.toThrow("Permission denied.");
    expect(mocks.orderCount).not.toHaveBeenCalled();
    expect(mocks.orderFindMany).not.toHaveBeenCalled();
  });
});
