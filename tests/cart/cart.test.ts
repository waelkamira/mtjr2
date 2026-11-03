import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guestFindUnique: vi.fn(),
  guestCreate: vi.fn(),
  guestUpdate: vi.fn(),
  guestUpsert: vi.fn(),
  guestUpdateMany: vi.fn(),
  cartUpsert: vi.fn(),
  marketFindFirst: vi.fn(),
  variantFindFirst: vi.fn(),
  inventoryFindMany: vi.fn(),
  cartItemFindUnique: vi.fn(),
  cartItemCreate: vi.fn(),
  cartItemUpdate: vi.fn(),
  cartItemCount: vi.fn(),
  currentSession: vi.fn(),
  transaction: vi.fn()
}));

const tx = {
  guestSession: { findUnique: mocks.guestFindUnique, create: mocks.guestCreate, update: mocks.guestUpdate, upsert: mocks.guestUpsert, updateMany: mocks.guestUpdateMany },
  cart: { upsert: mocks.cartUpsert },
  market: { findFirst: mocks.marketFindFirst },
  productVariant: { findFirst: mocks.variantFindFirst },
  inventory: { findMany: mocks.inventoryFindMany },
  cartItem: { findUnique: mocks.cartItemFindUnique, create: mocks.cartItemCreate, update: mocks.cartItemUpdate, count: mocks.cartItemCount }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));
vi.mock("@/server/identity/current-session", () => ({
  getCurrentSession: mocks.currentSession
}));

import { addCartItem } from "@/server/cart/cart";

describe("guest and customer cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentSession.mockResolvedValue(null);
    mocks.guestFindUnique.mockResolvedValue(null);
    mocks.guestCreate.mockResolvedValue({ id: "guest-1" });
    mocks.guestUpdate.mockResolvedValue({ id: "guest-1" });
    mocks.guestUpsert.mockResolvedValue({ id: "guest-1", expiresAt: new Date(Date.now() + 86400000), convertedAt: null });
    mocks.guestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cartUpsert.mockResolvedValue({ id: "cart-1" });
    mocks.marketFindFirst.mockResolvedValue({ id: "market-1" });
    mocks.variantFindFirst.mockResolvedValue({
      id: "variant-1",
      prices: [{ amountMinor: BigInt(1250), compareAtMinor: null, currency: { minorUnit: 2 } }],
      product: { id: "product-1", slug: "item", name: "Item", store: { name: "Store", slug: "store" }, media: [] }
    });
    mocks.inventoryFindMany.mockResolvedValue([{ quantityOnHand: 5, quantityReserved: 1 }]);
    mocks.cartItemFindUnique.mockResolvedValue(null);
    mocks.cartItemCreate.mockResolvedValue({ id: "cart-item-1" });
    mocks.cartItemCount.mockResolvedValue(1);
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  it("persists only a hash of the opaque guest token", async () => {
    await addCartItem("opaque-guest-token", {
      marketId: "market-1", currencyCode: "EUR", variantId: "variant-1", quantity: 1
    });
    const saved = mocks.guestUpsert.mock.calls[0][0].create.tokenHash as string;
    expect(saved).toMatch(/^[a-f0-9]{64}$/);
    expect(saved).not.toBe("opaque-guest-token");
  });

  it("adds a variant only after validating market, published listing and available stock", async () => {
    const result = await addCartItem("opaque-guest-token", {
      marketId: "market-1", currencyCode: "EUR", variantId: "variant-1", quantity: 2
    });
    expect(result).toEqual({ cartId: "cart-1", itemCount: 1 });
    expect(mocks.marketFindFirst).toHaveBeenCalledOnce();
    expect(mocks.variantFindFirst).toHaveBeenCalledOnce();
    expect(mocks.cartItemCreate).toHaveBeenCalledWith({
      data: { cartId: "cart-1", variantId: "variant-1", quantity: 2 }
    });
  });

  it("rejects quantities above the per-line limit before touching the database", async () => {
    await expect(addCartItem("opaque-guest-token", {
      marketId: "market-1", currencyCode: "EUR", variantId: "variant-1", quantity: 100
    })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an add that exceeds available stock", async () => {
    mocks.inventoryFindMany.mockResolvedValue([{ quantityOnHand: 2, quantityReserved: 1 }]);
    await expect(addCartItem("opaque-guest-token", {
      marketId: "market-1", currencyCode: "EUR", variantId: "variant-1", quantity: 2
    })).rejects.toThrow("not enough available stock");
    expect(mocks.cartItemCreate).not.toHaveBeenCalled();
  });
});
