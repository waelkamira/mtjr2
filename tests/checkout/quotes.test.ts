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
  inventoryUpdateMany: vi.fn(),
  executeRaw: vi.fn(),
  cartFindFirst: vi.fn()
}));

const tx = {
  checkoutQuote: {
    findUnique: mocks.quoteFindUnique, findMany: mocks.quoteFindMany, create: mocks.quoteCreate,
    findUniqueOrThrow: mocks.quoteFindUniqueOrThrow, update: mocks.quoteUpdate, updateMany: mocks.quoteUpdateMany
  },
  checkoutQuoteLine: { createMany: mocks.quoteLineCreateMany },
  inventoryReservation: { findMany: mocks.reservationFindMany, create: mocks.reservationCreate, update: mocks.reservationUpdate },
  inventory: { updateMany: mocks.inventoryUpdateMany },
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
        inventories: [{ id: "inventory-1", quantityOnHand: 10, quantityReserved: 0, warehouse: { id: "warehouse-1", storeId: "store-1" } }]
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

  it("fails when inventory cannot cover the full cart quantity", async () => {
    mocks.cartFindFirst.mockResolvedValue(cartSnapshot(11));
    await expect(createCheckoutQuote("opaque-guest-token", {
      cartId: "cart-1", idempotencyKey: "checkout-request-0002"
    })).rejects.toThrow("There is not enough stock");
  });
});
