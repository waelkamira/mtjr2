import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus, PaymentStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getPaymentProvider: vi.fn(),
  guestFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentFindUniqueOrThrow: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentCreate: vi.fn(),
  paymentUpdate: vi.fn(),
  paymentUpdateMany: vi.fn(),
  transaction: vi.fn(),
  txQueryRaw: vi.fn(),
  txOrderFindFirst: vi.fn(),
  txPaymentFindUnique: vi.fn(),
  txPaymentFindFirst: vi.fn(),
  txPaymentCreate: vi.fn(),
  txWebhookEventCreate: vi.fn(),
  txWebhookEventUpdate: vi.fn(),
  txCommissionRuleFindMany: vi.fn(),
  txCommissionTransactionCreateMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/server/payments/providers/registry", () => ({ getPaymentProvider: mocks.getPaymentProvider }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    guestSession: { findUnique: mocks.guestFindUnique },
    order: { findFirst: mocks.orderFindFirst },
    payment: {
      findUnique: mocks.paymentFindUnique,
      findUniqueOrThrow: mocks.paymentFindUniqueOrThrow,
      findFirst: mocks.paymentFindFirst,
      create: mocks.paymentCreate,
      update: mocks.paymentUpdate,
      updateMany: mocks.paymentUpdateMany
    },
    $transaction: mocks.transaction
  }
}));

import { processVerifiedPaymentEvent, startOrderPayment } from "@/server/payments/payments";

const tx = {
  $queryRaw: mocks.txQueryRaw,
  order: { findFirst: mocks.txOrderFindFirst, update: vi.fn() },
  payment: {
    findUnique: mocks.txPaymentFindUnique,
    findFirst: mocks.txPaymentFindFirst,
    create: mocks.txPaymentCreate,
    update: vi.fn()
  },
  paymentWebhookEvent: { create: mocks.txWebhookEventCreate, update: mocks.txWebhookEventUpdate },
  commissionRule: { findMany: mocks.txCommissionRuleFindMany },
  commissionTransaction: { createMany: mocks.txCommissionTransactionCreateMany },
  auditLog: { create: vi.fn() },
  orderStatusHistory: { create: vi.fn() },
  vendorOrder: { update: vi.fn() },
  vendorOrderStatusHistory: { create: vi.fn() },
  notification: { create: vi.fn() },
  notificationPreference: { findUnique: vi.fn() }
};

describe("payment lifecycle safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({ userId: "buyer-1" });
    mocks.getPaymentProvider.mockReturnValue({
      key: "test_provider",
      displayName: "Test provider",
      createIntent: vi.fn().mockResolvedValue({
        providerReference: "provider-ref-1",
        checkoutUrl: "https://payments.example.test/checkout/session-1",
        expiresAt: null
      }),
      verifyWebhook: vi.fn()
    });
    mocks.orderFindFirst.mockResolvedValue({
      id: "order-1", orderNumber: "ORD-1", status: OrderStatus.PENDING_PAYMENT,
      totalMinor: BigInt("1500"), currencyCode: "EUR"
    });
    mocks.txOrderFindFirst.mockResolvedValue({ id: "order-1" });
    mocks.txPaymentFindUnique.mockResolvedValue(null);
    mocks.txPaymentFindFirst.mockResolvedValue(null);
    mocks.txWebhookEventCreate.mockResolvedValue({ id: "webhook-event-1" });
    mocks.txWebhookEventUpdate.mockResolvedValue({});
    mocks.txCommissionRuleFindMany.mockResolvedValue([]);
    mocks.txCommissionTransactionCreateMany.mockResolvedValue({ count: 1 });
    tx.notificationPreference.findUnique.mockResolvedValue(null);
    tx.notification.create.mockResolvedValue({ id: "notification-1" });
    mocks.txPaymentCreate.mockResolvedValue({
      id: "payment-1", orderId: "order-1", provider: "test_provider",
      status: PaymentStatus.INITIATING, amountMinor: BigInt("1500"), currencyCode: "EUR",
      checkoutUrl: null, expiresAt: null, idempotencyKey: "idempotency-key-1"
    });
    mocks.paymentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.paymentFindUniqueOrThrow.mockResolvedValue({
      id: "payment-1", orderId: "order-1", provider: "test_provider",
      status: PaymentStatus.REQUIRES_ACTION, amountMinor: BigInt("1500"), currencyCode: "EUR",
      checkoutUrl: "https://payments.example.test/checkout/session-1", expiresAt: null
    });
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
  });

  it("does not overwrite a payment advanced by a webhook during a concurrent retry", async () => {
    mocks.paymentUpdateMany.mockResolvedValue({ count: 0 });
    mocks.paymentFindUniqueOrThrow.mockResolvedValue({
      id: "payment-1", orderId: "order-1", provider: "test_provider",
      status: PaymentStatus.SUCCEEDED, amountMinor: BigInt("1500"), currencyCode: "EUR",
      checkoutUrl: "https://payments.example.test/checkout/session-1", expiresAt: null
    });
    const result = await startOrderPayment({
      guestToken: "", orderId: "order-1", providerKey: "test_provider", idempotencyKey: "idempotency-key-1"
    });
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-1", status: PaymentStatus.INITIATING }
    }));
    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it("requires an explicitly configured provider before reading or mutating an order", async () => {
    mocks.getPaymentProvider.mockReturnValue(null);
    await expect(startOrderPayment({
      guestToken: "guest-token", orderId: "order-1", providerKey: "missing_provider",
      idempotencyKey: "idempotency-key-1"
    })).rejects.toThrow("not configured");
    expect(mocks.orderFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("scopes order lookup to the authenticated buyer and binds the intent to the server total/currency", async () => {
    const provider = mocks.getPaymentProvider();
    const result = await startOrderPayment({
      guestToken: "", orderId: "order-1", providerKey: "test_provider",
      idempotencyKey: "idempotency-key-1"
    });
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1", userId: "buyer-1" }
    }));
    expect(provider.createIntent).toHaveBeenCalledWith(expect.objectContaining({
      amountMinor: "1500", currencyCode: "EUR", idempotencyKey: "idempotency-key-1"
    }));
    expect(result.checkoutUrl).toBe("https://payments.example.test/checkout/session-1");
  });

  it("does not allow switching provider while another payment attempt is active", async () => {
    mocks.txPaymentFindFirst.mockResolvedValue({
      id: "payment-active", orderId: "order-1", provider: "another_provider",
      status: PaymentStatus.REQUIRES_ACTION, amountMinor: BigInt("1500"), currencyCode: "EUR",
      checkoutUrl: "https://payments.example.test/active", expiresAt: null
    });
    await expect(startOrderPayment({
      guestToken: "", orderId: "order-1", providerKey: "test_provider",
      idempotencyKey: "idempotency-key-2"
    })).rejects.toThrow("already active with another provider");
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled();
    expect(mocks.getPaymentProvider().createIntent).not.toHaveBeenCalled();
  });

  it("preserves a partially refunded payment when a later success webhook is replayed", async () => {
    const occurredAt = new Date("2026-11-05T12:00:00.000Z");
    mocks.txPaymentFindUnique
      .mockResolvedValueOnce({ id: "payment-1", orderId: "order-1" })
      .mockResolvedValueOnce({
        id: "payment-1", orderId: "order-1", provider: "test_provider",
        providerReference: "provider-ref-1", amountMinor: BigInt("1500"), currencyCode: "EUR",
        status: PaymentStatus.PARTIALLY_REFUNDED, lastProviderEventAt: new Date("2026-11-05T11:00:00.000Z"),
        succeededAt: new Date("2026-11-04T10:00:00.000Z"),
        order: { status: OrderStatus.CONFIRMED, orderNumber: "ORD-1", userId: "buyer-1", vendorOrders: [] }
      });
    mocks.txWebhookEventCreate.mockResolvedValue({ id: "webhook-1" });

    const result = await processVerifiedPaymentEvent({
      providerKey: "test_provider",
      event: {
        eventId: "evt-late-success", eventType: "succeeded", providerReference: "provider-ref-1",
        amountMinor: "1500", currencyCode: "EUR", occurredAt
      },
      payloadHash: "b".repeat(64)
    });

    expect(result).toMatchObject({ accepted: true, duplicate: false, paymentId: "payment-1", status: PaymentStatus.PARTIALLY_REFUNDED });
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PaymentStatus.PARTIALLY_REFUNDED })
    }));
    expect(mocks.txWebhookEventUpdate).toHaveBeenCalledOnce();
  });


  it("rejects a verified webhook whose amount or currency does not match the stored payment", async () => {
    mocks.txPaymentFindUnique
      .mockResolvedValueOnce({ id: "payment-1", orderId: "order-1" })
      .mockResolvedValueOnce({
        id: "payment-1", orderId: "order-1", provider: "test_provider",
        providerReference: "provider-ref-1", amountMinor: BigInt("1500"), currencyCode: "EUR",
        status: PaymentStatus.REQUIRES_ACTION, lastProviderEventAt: null, succeededAt: null,
        order: { status: OrderStatus.PENDING_PAYMENT, orderNumber: "ORD-1", userId: "buyer-1", vendorOrders: [] }
      });
    await expect(processVerifiedPaymentEvent({
      providerKey: "test_provider",
      event: {
        eventId: "evt-1", eventType: "succeeded", providerReference: "provider-ref-1",
        amountMinor: "1499", currencyCode: "EUR", occurredAt: new Date("2026-11-04T10:00:00.000Z")
      },
      payloadHash: "a".repeat(64)
    })).rejects.toThrow("amount or currency does not match");
    expect(mocks.txWebhookEventCreate).not.toHaveBeenCalled();
  });

  it("snapshots discounted item commission once when payment succeeds", async () => {
    const occurredAt = new Date("2026-11-06T12:00:00.000Z");
    mocks.txPaymentFindUnique
      .mockResolvedValueOnce({ id: "payment-1", orderId: "order-1" })
      .mockResolvedValueOnce({
        id: "payment-1", orderId: "order-1", provider: "test_provider",
        providerReference: "provider-ref-1", amountMinor: BigInt("1500"), currencyCode: "EUR",
        status: PaymentStatus.REQUIRES_ACTION, lastProviderEventAt: null, succeededAt: null,
        order: {
          id: "order-1", status: OrderStatus.PENDING_PAYMENT, orderNumber: "ORD-1", userId: null,
          vendorOrders: [{
            id: "vendor-1", storeId: "store-1", subtotalMinor: BigInt("1000"), discountMinor: BigInt("100"),
            items: [{
              id: "item-1", lineTotalMinor: BigInt("1000"),
              commissionCategoryId: "category-1", commissionCategoryName: "Phones"
            }],
            store: { seller: { id: "seller-1", ownerId: "seller-owner-1" } }
          }]
        }
      });
    mocks.txCommissionRuleFindMany.mockResolvedValue([
      {
        id: "global-rule", sellerId: null, categoryId: null, rateBasisPoints: 500,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveUntil: null,
        isActive: true, deactivatedAt: null
      },
      {
        id: "category-rule", sellerId: null, categoryId: "category-1", rateBasisPoints: 1_000,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveUntil: null,
        isActive: true, deactivatedAt: null
      }
    ]);

    await expect(processVerifiedPaymentEvent({
      providerKey: "test_provider",
      event: {
        eventId: "evt-success", eventType: "succeeded", providerReference: "provider-ref-1",
        amountMinor: "1500", currencyCode: "EUR", occurredAt
      },
      payloadHash: "b".repeat(64),
      now: new Date("2026-11-06T12:00:01.000Z")
    })).resolves.toMatchObject({ accepted: true, status: PaymentStatus.SUCCEEDED });

    expect(mocks.txCommissionTransactionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        orderItemId: "item-1",
        commissionRuleId: "category-rule",
        categoryId: "category-1",
        categoryName: "Phones",
        ruleScopeType: "CATEGORY",
        rateBasisPoints: 1_000,
        baseAmountMinor: BigInt("900"),
        commissionMinor: BigInt("90"),
        currencyCode: "EUR"
      })]
    });
  });
});
