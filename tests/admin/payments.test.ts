import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  paymentCount: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentGroupBy: vi.fn(),
  paymentFindUnique: vi.fn(),
  currencyFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requireAnyPermission: mocks.requireAnyPermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: {
      count: mocks.paymentCount,
      findMany: mocks.paymentFindMany,
      groupBy: mocks.paymentGroupBy,
      findUnique: mocks.paymentFindUnique
    },
    currency: { findMany: mocks.currencyFindMany }
  }
}));

import { getAdminPayment, listAdminPayments } from "@/server/admin/payments";

describe("admin payment operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAnyPermission.mockResolvedValue({ userId: "admin-1" });
    mocks.paymentCount.mockResolvedValue(1);
    mocks.paymentFindMany.mockResolvedValue([{
      id: "payment-1", orderId: "order-1", provider: "test", status: "FAILED",
      amountMinor: BigInt(1234), currencyCode: "USD", currency: { minorUnit: 2 },
      failureCode: "DECLINED", createdAt: new Date("2026-11-05T12:00:00Z"),
      succeededAt: null, order: { orderNumber: "MTJ-1", status: "PENDING_PAYMENT", user: null }
    }]);
    mocks.paymentGroupBy.mockResolvedValue([{
      status: "FAILED", currencyCode: "USD", _count: { _all: 1 }, _sum: { amountMinor: BigInt(1234) }
    }]);
    mocks.currencyFindMany.mockResolvedValue([{ code: "USD", minorUnit: 2 }]);
  });

  it("filters and paginates payment attempts with currency-specific aggregates", async () => {
    const result = await listAdminPayments({
      q: "MTJ-1", provider: "test", status: "FAILED", page: "2", limit: "10"
    });

    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(expect.arrayContaining([
      { permissionKey: "payments:read", now: expect.any(Date) },
      { permissionKey: "payments:refund", now: expect.any(Date) }
    ]), expect.any(Date));
    expect(mocks.paymentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({ provider: "test", status: "FAILED" })
    }));
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      totalsByStatusCurrency: [{ status: "FAILED", currencyCode: "USD", minorUnit: 2, paymentCount: 1, amountMinor: "1234" }],
      items: [{ amountMinor: "1234", succeededAt: null }]
    });
  });

  it("returns webhook processing history without exposing provider references or checkout URLs", async () => {
    const receivedAt = new Date("2026-11-05T12:00:00Z");
    mocks.paymentFindUnique.mockResolvedValue({
      id: "payment-1", orderId: "order-1", provider: "test", status: "FAILED",
      amountMinor: BigInt(1234), currencyCode: "USD", currency: { minorUnit: 2 },
      failureCode: "DECLINED", failureMessage: "Issuer declined.", expiresAt: null,
      succeededAt: null, lastProviderEventAt: receivedAt, createdAt: receivedAt, updatedAt: receivedAt,
      order: {
        orderNumber: "MTJ-1", status: "PENDING_PAYMENT", totalMinor: BigInt(1234),
        currencyCode: "USD", currency: { minorUnit: 2 }, placedAt: receivedAt, user: null
      },
      events: [{
        id: "event-1", provider: "test", eventType: "payment.failed", payloadHash: "a".repeat(64),
        receivedAt, processedAt: receivedAt, processingError: null
      }]
    });

    const result = await getAdminPayment("payment-1");

    expect(result.amountMinor).toBe("1234");
    expect(result.events[0].receivedAt).toBe(receivedAt.toISOString());
    const select = mocks.paymentFindUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("providerReference");
    expect(select).not.toHaveProperty("checkoutUrl");
    expect(select.events.select).not.toHaveProperty("providerEventId");
  });

  it("does not read payment data when permission is denied", async () => {
    mocks.requireAnyPermission.mockRejectedValue(new Error("Permission denied."));

    await expect(listAdminPayments({})).rejects.toThrow("Permission denied.");
    expect(mocks.paymentCount).not.toHaveBeenCalled();
    expect(mocks.paymentFindMany).not.toHaveBeenCalled();
  });
});
