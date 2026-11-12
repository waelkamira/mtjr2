import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  returnRequestFindUnique: vi.fn(),
  paymentFindMany: vi.fn(),
  refundFindUnique: vi.fn(),
  refundFindMany: vi.fn(),
  refundItemFindMany: vi.fn(),
  refundAggregate: vi.fn(),
  refundCreate: vi.fn(),
  refundUpdateMany: vi.fn(),
  paymentUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));

import { completeManualRefund, createRefundForReturn } from "@/server/payments/refunds";

describe("manual return refund lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "finance-1" });
    mocks.returnRequestFindUnique.mockResolvedValue({
      id: "return-1", status: "RECEIVED", orderId: "order-1",
      order: { id: "order-1", orderNumber: "ORD-1", currencyCode: "EUR" },
      items: [{
        id: "return-item-1", quantity: 1,
        orderItem: {
           id: "order-item-1", quantity: 2, lineTotalMinor: BigInt(3000), productName: "Item", sku: "SKU-1",
           vendorOrder: {
             id: "vendor-order-1", subtotalMinor: BigInt(3000), discountMinor: BigInt(300),
             items: [{ id: "order-item-1", lineTotalMinor: BigInt(3000) }]
           }
         }
      }]
    });
    mocks.refundFindUnique.mockResolvedValue(null);
    mocks.paymentFindMany.mockResolvedValue([{ id: "payment-1", amountMinor: BigInt(5000), currencyCode: "EUR", status: "SUCCEEDED" }]);
    mocks.refundItemFindMany.mockResolvedValue([]);
    mocks.refundAggregate.mockResolvedValue({ _sum: { amountMinor: null } });
    mocks.refundCreate.mockResolvedValue({ id: "refund-1", status: "PENDING_MANUAL", amountMinor: BigInt(1350) });
    mocks.refundUpdateMany.mockResolvedValue({ count: 1 });
    mocks.paymentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
  });

  function transactionWith(tx: Record<string, unknown>) {
    mocks.transaction.mockImplementation(async (callback: (value: unknown) => unknown) => callback(tx));
  }

  it("creates a pending merchandise refund only after receipt and leaves payment status unchanged", async () => {
    const tx = {
      returnRequest: { findUnique: mocks.returnRequestFindUnique },
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, create: mocks.refundCreate },
      payment: { findMany: mocks.paymentFindMany },
      refundItem: { findMany: mocks.refundItemFindMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    };
    transactionWith(tx);

    const result = await createRefundForReturn({ returnRequestId: "return-1" });

    expect(result).toMatchObject({ id: "refund-1", status: "PENDING_MANUAL", amountMinor: "1350", alreadyApplied: false });
    expect(mocks.refundCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: "order-1", paymentId: "payment-1", returnRequestId: "return-1",
        amountMinor: BigInt(1350), idempotencyKey: "return-refund:return-1",
        items: { create: [{ returnItemId: "return-item-1", quantity: 1, amountMinor: BigInt(1350) }] }
      })
    }));
    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled();
  });

  it("subtracts the vendor coupon allocation before calculating a partial item refund", async () => {
    const tx = {
      returnRequest: { findUnique: mocks.returnRequestFindUnique },
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, create: mocks.refundCreate },
      payment: { findMany: mocks.paymentFindMany },
      refundItem: { findMany: mocks.refundItemFindMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    };
    transactionWith(tx);

    const result = await createRefundForReturn({ returnRequestId: "return-1" });

    // 3,000 merchandise - 300 coupon = 2,700 net; one of two units = 1,350.
    expect(result.amountMinor).toBe("1350");
    expect(mocks.refundCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amountMinor: BigInt(1350),
        items: { create: [{ returnItemId: "return-item-1", quantity: 1, amountMinor: BigInt(1350) }] }
      })
    }));
  });

  it("does not create a refund for an unreceived return", async () => {
    mocks.returnRequestFindUnique.mockResolvedValue({ id: "return-1", status: "APPROVED", orderId: "order-1" });
    transactionWith({
      returnRequest: { findUnique: mocks.returnRequestFindUnique },
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, create: mocks.refundCreate },
      payment: { findMany: mocks.paymentFindMany },
      refundItem: { findMany: mocks.refundItemFindMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    });
    await expect(createRefundForReturn({ returnRequestId: "return-1" }))
      .rejects.toThrow("Only physically received return items");
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  it("replays the existing refund for the same return request", async () => {
    mocks.refundFindUnique.mockResolvedValue({
      id: "refund-existing", status: "PENDING_MANUAL", amountMinor: BigInt(1500)
    });
    transactionWith({
      returnRequest: { findUnique: mocks.returnRequestFindUnique },
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, create: mocks.refundCreate },
      payment: { findMany: mocks.paymentFindMany },
      refundItem: { findMany: mocks.refundItemFindMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    });
    const result = await createRefundForReturn({ returnRequestId: "return-1" });
    expect(result).toMatchObject({ id: "refund-existing", alreadyApplied: true });
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  it("prevents a refund from exceeding the captured payment", async () => {
    mocks.paymentFindMany.mockResolvedValue([{ id: "payment-1", amountMinor: BigInt(1000), currencyCode: "EUR", status: "SUCCEEDED" }]);
    transactionWith({
      returnRequest: { findUnique: mocks.returnRequestFindUnique },
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, create: mocks.refundCreate },
      payment: { findMany: mocks.paymentFindMany },
      refundItem: { findMany: mocks.refundItemFindMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    });
    await expect(createRefundForReturn({ returnRequestId: "return-1" }))
      .rejects.toThrow("exceed the captured payment balance");
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  it("records an external refund and changes payment to partially refunded only after finance confirmation", async () => {
    mocks.refundFindUnique.mockResolvedValue({
      id: "refund-1", orderId: "order-1", paymentId: "payment-1",
      amountMinor: BigInt(2000), status: "PENDING_MANUAL", externalReference: null,
      payment: { amountMinor: BigInt(5000), status: "SUCCEEDED" }
    });
    mocks.refundAggregate.mockResolvedValue({ _sum: { amountMinor: BigInt(1000) } });
    transactionWith({
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, updateMany: mocks.refundUpdateMany },
      payment: { updateMany: mocks.paymentUpdateMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    });

    const result = await completeManualRefund("refund-1", { externalReference: "provider-refund-123" });

    expect(result).toMatchObject({ status: "COMPLETED", paymentStatus: "PARTIALLY_REFUNDED", alreadyApplied: false });
    expect(mocks.refundUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "COMPLETED", externalReference: "provider-refund-123", completedById: "finance-1" })
    }));
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "PARTIALLY_REFUNDED" }
    }));
  });

  it("marks the payment fully refunded only when completed refunds equal the captured amount", async () => {
    mocks.refundFindUnique.mockResolvedValue({
      id: "refund-1", orderId: "order-1", paymentId: "payment-1",
      amountMinor: BigInt(2000), status: "PENDING_MANUAL", externalReference: null,
      payment: { amountMinor: BigInt(5000), status: "PARTIALLY_REFUNDED" }
    });
    mocks.refundAggregate.mockResolvedValue({ _sum: { amountMinor: BigInt(3000) } });
    transactionWith({
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, updateMany: mocks.refundUpdateMany },
      payment: { updateMany: mocks.paymentUpdateMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    });
    const result = await completeManualRefund("refund-1", { externalReference: "provider-refund-456" });
    expect(result.paymentStatus).toBe("REFUNDED");
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "REFUNDED" }
    }));
  });

  it("treats the same external completion reference as an idempotent retry", async () => {
    mocks.refundFindUnique.mockResolvedValue({
      id: "refund-1", orderId: "order-1", paymentId: "payment-1",
      amountMinor: BigInt(2000), status: "COMPLETED", externalReference: "provider-refund-789",
      payment: { amountMinor: BigInt(5000), status: "PARTIALLY_REFUNDED" }
    });
    transactionWith({
      refund: { findUnique: mocks.refundFindUnique, aggregate: mocks.refundAggregate, updateMany: mocks.refundUpdateMany },
      payment: { updateMany: mocks.paymentUpdateMany },
      auditLog: { create: mocks.auditCreate },
      $queryRaw: mocks.queryRaw
    });
    const result = await completeManualRefund("refund-1", { externalReference: "provider-refund-789" });
    expect(result.alreadyApplied).toBe(true);
    expect(mocks.refundUpdateMany).not.toHaveBeenCalled();
    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled();
  });
});
