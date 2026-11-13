import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getCheckoutQuote: vi.fn(),
  guestFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  orderFindUniqueOrThrow: vi.fn(),
  quoteFindFirst: vi.fn(),
  quoteUpdate: vi.fn(),
  quoteUpdateMany: vi.fn(),
  cartUpdate: vi.fn(),
  cartUpdateMany: vi.fn(),
  couponRedemptionCount: vi.fn(),
  couponRedemptionCreate: vi.fn(),
  reservationFindMany: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  reservationUpdate: vi.fn(),
  reservationUpdateMany: vi.fn(),
  inventoryMovementCreate: vi.fn(),
  vendorOrderCreate: vi.fn(),
  storeFindUniqueOrThrow: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  notify: vi.fn()
}));

const tx = {
  checkoutQuote: { findFirst: mocks.quoteFindFirst, update: mocks.quoteUpdate, updateMany: mocks.quoteUpdateMany },
  cart: { update: mocks.cartUpdate, updateMany: mocks.cartUpdateMany },
  order: { create: mocks.orderCreate, findUniqueOrThrow: mocks.orderFindUniqueOrThrow },
  couponRedemption: { count: mocks.couponRedemptionCount, create: mocks.couponRedemptionCreate },
  inventoryReservation: { findMany: mocks.reservationFindMany, update: mocks.reservationUpdate, updateMany: mocks.reservationUpdateMany },
  inventory: { updateMany: mocks.inventoryUpdateMany },
  inventoryMovement: { create: mocks.inventoryMovementCreate },
  vendorOrder: { create: mocks.vendorOrderCreate },
  store: { findUniqueOrThrow: mocks.storeFindUniqueOrThrow },
  auditLog: { create: mocks.auditCreate }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    guestSession: { findUnique: mocks.guestFindUnique },
    order: { findFirst: mocks.orderFindFirst },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/server/identity/current-session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/server/checkout/quotes", () => ({ getCheckoutQuote: mocks.getCheckoutQuote }));
vi.mock("@/server/notifications/notifications", () => ({ createInAppNotification: mocks.notify }));

import { placeOrderFromCheckoutQuote } from "@/server/orders/orders";

function checkoutQuote() {
  return {
    id: "quote-1", status: "ACTIVE", cartId: "cart-1", userId: "buyer-1", guestSessionId: null,
    marketId: "market-1", currencyCode: "EUR", subtotalMinor: BigInt(30000),
    couponId: "coupon-1", couponCode: "SAVE10", discountMinor: BigInt(3000),
    expiresAt: new Date(Date.now() + 600000),
    deliveryAddress: {
      recipientName: "Buyer", phone: "+31612345678", countryCode: "NL", countryName: "Netherlands",
      line1: "Main Street 1", line2: null, city: "Amsterdam", region: null, postalCode: "1000AA"
    },
    lines: [
      { id: "line-1", storeId: "store-1", lineTotalMinor: BigInt(10000), variantId: "variant-1", variant: { productId: "product-1", product: { categories: [] } }, productName: "One", storeName: "One Store", sku: "ONE", variantName: null, quantity: 1, unitAmountMinor: BigInt(10000) },
      { id: "line-2", storeId: "store-2", lineTotalMinor: BigInt(20000), variantId: "variant-2", variant: { productId: "product-2", product: { categories: [] } }, productName: "Two", storeName: "Two Store", sku: "TWO", variantName: null, quantity: 1, unitAmountMinor: BigInt(20000) }
    ],
    shippingSelections: [
      { storeId: "store-1", amountMinor: BigInt(250), currencyCode: "EUR", destinationRegion: null, serviceName: "Standard", shippingRateId: "rate-1", minDeliveryDays: 2, maxDeliveryDays: 4 },
      { storeId: "store-2", amountMinor: BigInt(250), currencyCode: "EUR", destinationRegion: null, serviceName: "Standard", shippingRateId: "rate-2", minDeliveryDays: 2, maxDeliveryDays: 4 }
    ],
    taxSnapshot: {
      destinationRegion: null, includesShipping: true, taxableAmountMinor: BigInt(27500),
      currencyCode: "EUR", taxAmountMinor: BigInt(2750), ruleName: "VAT", rateBasisPoints: 1000,
      isInclusive: false
    },
    coupon: {
      id: "coupon-1", isActive: true, startsAt: null, expiresAt: null, maxRedemptions: 10
    },
    cart: { id: "cart-1", status: "ACTIVE" }
  };
}

describe("checkout order placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({ userId: "buyer-1" });
    mocks.getCheckoutQuote.mockResolvedValue({ status: "ACTIVE" });
    mocks.orderFindFirst.mockResolvedValue(null);
    mocks.quoteFindFirst.mockResolvedValue(checkoutQuote());
    mocks.couponRedemptionCount.mockResolvedValue(0);
    mocks.orderCreate.mockResolvedValue({ id: "order-1", orderNumber: "MTJ-ORDER-1" });
    mocks.vendorOrderCreate.mockResolvedValue({ id: "vendor-order-1" });
    mocks.reservationFindMany.mockResolvedValue([
      { id: "reservation-1", quantity: 1, inventory: { id: "inventory-1", variantId: "variant-1" } },
      { id: "reservation-2", quantity: 1, inventory: { id: "inventory-2", variantId: "variant-2" } }
    ]);
    mocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.reservationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.quoteUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cartUpdateMany.mockResolvedValue({ count: 1 });
    mocks.storeFindUniqueOrThrow.mockResolvedValue({ name: "Store", seller: { ownerId: "seller-1" } });
    mocks.orderFindUniqueOrThrow.mockResolvedValue({
      id: "order-1", orderNumber: "MTJ-ORDER-1", status: "PENDING_PAYMENT", currencyCode: "EUR",
      currency: { minorUnit: 2, symbol: "€" }, subtotalMinor: BigInt(30000),
      couponCode: "SAVE10", discountMinor: BigInt(3000), shippingMinor: BigInt(500),
      taxMinor: BigInt(2750), totalMinor: BigInt(30250), taxRuleName: "VAT",
      taxRateBasisPoints: 1000, taxInclusive: false, taxIncludesShipping: true,
      taxDestinationRegion: null, placedAt: new Date(),
      address: checkoutQuote().deliveryAddress, vendorOrders: []
    });
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  it("creates the discounted order and records coupon redemption atomically", async () => {
    const result = await placeOrderFromCheckoutQuote("", "quote-1");

    expect(result).toMatchObject({
      subtotalMinor: "30000", couponCode: "SAVE10", discountMinor: "3000",
      shippingMinor: "500", taxMinor: "2750", totalMinor: "30250"
    });
    expect(mocks.orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subtotalMinor: BigInt(30000), couponId: "coupon-1", couponCode: "SAVE10",
        discountMinor: BigInt(3000), totalMinor: BigInt(30250)
      })
    }));
    expect(mocks.couponRedemptionCreate).toHaveBeenCalledWith({
      data: { couponId: "coupon-1", orderId: "order-1", userId: "buyer-1" }
    });
    expect(mocks.vendorOrderCreate).toHaveBeenCalledTimes(2);
    const vendorDiscount = mocks.vendorOrderCreate.mock.calls.reduce(
      (total, [input]) => total + input.data.discountMinor,
      BigInt(0)
    );
    expect(vendorDiscount).toBe(BigInt(3000));
    expect(mocks.inventoryMovementCreate).toHaveBeenCalledTimes(2);
    expect(mocks.reservationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "reservation-1", status: "ACTIVE", expiresAt: { gt: expect.any(Date) } },
      data: { status: "CONSUMED", consumedAt: expect.any(Date) }
    }));
    expect(mocks.quoteUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "quote-1", status: "ACTIVE", expiresAt: { gt: expect.any(Date) } },
      data: { status: "CONVERTED" }
    }));
    expect(mocks.cartUpdateMany).toHaveBeenCalledWith({
      where: { id: "cart-1", status: "ACTIVE" },
      data: { status: "CHECKED_OUT" }
    });

  });

  it("rolls back order placement if a reservation was released before it could be consumed", async () => {
    mocks.reservationUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(placeOrderFromCheckoutQuote("", "quote-1"))
      .rejects.toThrow("reservation expired or was released");

    expect(mocks.quoteUpdateMany).not.toHaveBeenCalled();
    expect(mocks.cartUpdateMany).not.toHaveBeenCalled();
  });

  it("does not place an order when the coupon limit is exhausted", async () => {
    mocks.couponRedemptionCount.mockResolvedValue(10);

    await expect(placeOrderFromCheckoutQuote("", "quote-1")).rejects.toThrow("reached its redemption limit");

    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.couponRedemptionCreate).not.toHaveBeenCalled();
  });

  it("returns the already committed order after a serializable concurrent retry", async () => {
    const savedOrder = {
      id: "order-1", orderNumber: "MTJ-ORDER-1", status: "PENDING_PAYMENT", currencyCode: "EUR",
      currency: { minorUnit: 2, symbol: "€" }, subtotalMinor: BigInt(30000),
      couponCode: "SAVE10", discountMinor: BigInt(3000), shippingMinor: BigInt(500),
      taxMinor: BigInt(2750), totalMinor: BigInt(30250), taxRuleName: "VAT",
      taxRateBasisPoints: 1000, taxInclusive: false, taxIncludesShipping: true,
      taxDestinationRegion: null, placedAt: new Date(),
      address: checkoutQuote().deliveryAddress, vendorOrders: []
    };
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("serialization conflict", {
      code: "P2034", clientVersion: "6.19.0"
    }));
    mocks.orderFindFirst.mockResolvedValue(savedOrder);

    const result = await placeOrderFromCheckoutQuote("", "quote-1");

    expect(result.id).toBe("order-1");
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { quoteId: "quote-1", userId: "buyer-1" }
    }));
  });
});
