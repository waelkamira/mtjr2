import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guestFindUnique: vi.fn(),
  transaction: vi.fn(),
  getCurrentSession: vi.fn(),
  getActiveCarts: vi.fn(),
  quoteFindUnique: vi.fn(),
  quoteFindMany: vi.fn(),
  quoteCreate: vi.fn(),
  quoteFindUniqueOrThrow: vi.fn(),
  quoteUpdate: vi.fn(),
  quoteUpdateMany: vi.fn(),
  quoteLineCreateMany: vi.fn(),
  reservationFindMany: vi.fn(),
  reservationCreate: vi.fn(),
  reservationUpdate: vi.fn(),
  reservationUpdateMany: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  executeRaw: vi.fn(),
  cartFindFirst: vi.fn(),
  couponFindUnique: vi.fn(),
  couponRedemptionCount: vi.fn()
}));

const tx = {
  checkoutQuote: {
    findUnique: mocks.quoteFindUnique, findMany: mocks.quoteFindMany, create: mocks.quoteCreate,
    findUniqueOrThrow: mocks.quoteFindUniqueOrThrow, update: mocks.quoteUpdate, updateMany: mocks.quoteUpdateMany
  },
  checkoutQuoteLine: { createMany: mocks.quoteLineCreateMany },
  inventoryReservation: { findMany: mocks.reservationFindMany, create: mocks.reservationCreate, update: mocks.reservationUpdate, updateMany: mocks.reservationUpdateMany },
  inventory: { updateMany: mocks.inventoryUpdateMany },
  coupon: { findUnique: mocks.couponFindUnique },
  couponRedemption: { count: mocks.couponRedemptionCount },
  cart: { findFirst: mocks.cartFindFirst },
  $executeRaw: mocks.executeRaw
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { guestSession: { findUnique: mocks.guestFindUnique }, $transaction: mocks.transaction }
}));
vi.mock("@/server/identity/current-session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/server/cart/cart", () => ({ getActiveCarts: mocks.getActiveCarts }));

import { createCheckoutQuote } from "@/server/checkout/quotes";

function quoteSnapshot() {
  return {
    id: "quote-1", status: "ACTIVE", market: { code: "NL", name: "Netherlands" },
    currency: { code: "EUR", symbol: "€", minorUnit: 2 }, subtotalMinor: BigInt(2400),
    couponId: null, couponCode: null, discountMinor: BigInt(0),
    expiresAt: new Date(Date.now() + 600000),
    lines: [{ id: "line-1", productName: "Product", storeName: "Store", sku: "SKU-1", variantName: "Large", quantity: 2, unitAmountMinor: BigInt(1200), lineTotalMinor: BigInt(2400) }]
  };
}

function cartSnapshot(quantity = 2) {
  return {
    id: "cart-1", marketId: "market-1", currencyCode: "EUR",
    market: { id: "market-1", code: "NL", name: "Netherlands", status: "ACTIVE", country: { isActive: true } },
    currency: { code: "EUR", symbol: "€", minorUnit: 2, isActive: true },
    items: [{
      quantity,
      variant: {
        id: "variant-1", sku: "SKU-1", name: "Large", isActive: true,
        product: {
          id: "product-1", name: "Product", status: "ACTIVE", approvalStatus: "APPROVED", storeId: "store-1",
          store: { name: "Store", status: "ACTIVE", seller: { status: "ACTIVE" }, markets: [{ marketId: "market-1" }] }
        },
        prices: [{ marketId: "market-1", currencyCode: "EUR", amountMinor: BigInt(1200) }],
        inventories: [{ id: "inventory-1", quantityOnHand: 10, quantityReserved: 0, quantityQuarantined: 0, warehouse: { id: "warehouse-1", storeId: "store-1" } }]
      }
    }]
  };
}

describe("checkout quote and inventory reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.getActiveCarts.mockResolvedValue([]);
    mocks.guestFindUnique.mockResolvedValue({ id: "guest-1", expiresAt: new Date(Date.now() + 86400000), convertedAt: null });
    mocks.quoteFindUnique.mockResolvedValue(null);
    mocks.quoteFindMany.mockResolvedValue([]);
    mocks.reservationFindMany.mockResolvedValue([]);
    mocks.quoteCreate.mockResolvedValue({ id: "quote-1" });
    mocks.quoteFindUniqueOrThrow.mockResolvedValue(quoteSnapshot());
    mocks.quoteLineCreateMany.mockResolvedValue({ count: 1 });
    mocks.executeRaw.mockResolvedValue(1);
    mocks.reservationCreate.mockResolvedValue({ id: "reservation-1" });
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    mocks.cartFindFirst.mockResolvedValue(cartSnapshot());
    mocks.couponFindUnique.mockResolvedValue(null);
    mocks.couponRedemptionCount.mockResolvedValue(0);
  });

  it("creates an immutable price snapshot and reserves inventory atomically", async () => {
    const result = await createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-request-0001"
    });
    expect(result.subtotalMinor).toBe("2400");
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    expect(mocks.reservationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        inventoryId: "inventory-1", quantity: 2, referenceType: "CHECKOUT_QUOTE",
        referenceId: "quote-1", status: "ACTIVE"
      })
    }));
    expect(mocks.quoteLineCreateMany).toHaveBeenCalledOnce();
  });

  it("replays the same quote for the same idempotency key without reserving twice", async () => {
    mocks.quoteFindUnique.mockResolvedValue({ ...quoteSnapshot(), cartId: "cart-1", guestSessionId: "guest-1", userId: null });
    const result = await createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-request-0001"
    });
    expect(result.id).toBe("quote-1");
    expect(mocks.cartFindFirst).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("applies an active percentage coupon to the server-calculated merchandise subtotal", async () => {
    mocks.quoteFindUniqueOrThrow.mockResolvedValue({
      ...quoteSnapshot(), couponCode: "SAVE10", discountMinor: BigInt(240)
    });
    mocks.couponFindUnique.mockResolvedValue({
      id: "coupon-1", code: "SAVE10", discountType: "PERCENTAGE", value: BigInt(1000),
      currencyCode: null, maxRedemptions: 10,
      startsAt: null, expiresAt: null, isActive: true
    });
    const result = await createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-coupon-0001", couponCode: "save10"
    });
    expect(result).toMatchObject({ couponCode: "SAVE10", discountMinor: "240" });
    expect(mocks.quoteUpdate).toHaveBeenCalledWith({
      where: { id: "quote-1" }, data: { subtotalMinor: BigInt(2400), couponId: "coupon-1", discountMinor: BigInt(240) }
    });
  });

  it("rejects fixed-amount coupons configured for a different cart currency", async () => {
    mocks.couponFindUnique.mockResolvedValue({
      id: "coupon-1", code: "TENUSD", discountType: "FIXED_AMOUNT", value: BigInt(1000),
      currencyCode: "USD", maxRedemptions: null,
      startsAt: null, expiresAt: null, isActive: true
    });
    await expect(createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-coupon-0002", couponCode: "TENUSD"
    })).rejects.toThrow("not valid for the cart currency");
  });

  it("rejects coupons after their configured redemption limit is reached", async () => {
    mocks.couponFindUnique.mockResolvedValue({
      id: "coupon-1", code: "LIMITED", discountType: "PERCENTAGE", value: BigInt(1000),
      currencyCode: null, maxRedemptions: 1,
      startsAt: null, expiresAt: null, isActive: true
    });
    mocks.couponRedemptionCount.mockResolvedValue(1);
    await expect(createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-coupon-0003", couponCode: "LIMITED"
    })).rejects.toThrow("reached its redemption limit");
  });

  it("does not allocate quarantined units to a checkout quote", async () => {
    const cart = cartSnapshot(2);
    cart.items[0].variant.inventories[0].quantityQuarantined = 9;
    mocks.cartFindFirst.mockResolvedValue(cart);
    await expect(createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-quarantine-0001"
    })).rejects.toThrow("There is not enough stock");
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    const sqlParts = mocks.executeRaw.mock.calls[0][0] as readonly string[];
    expect(sqlParts.join(" ")).toContain('"quantityQuarantined"');
    expect(mocks.reservationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inventoryId: "inventory-1", quantity: 1, status: "ACTIVE" })
    }));
  });

  it("fails when inventory cannot cover the full cart quantity", async () => {
    mocks.cartFindFirst.mockResolvedValue(cartSnapshot(11));
    await expect(createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-request-0002"
    })).rejects.toThrow("There is not enough stock");
  });
});
