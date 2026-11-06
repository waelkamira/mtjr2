import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getCheckoutQuote: vi.fn(),
  guestFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  saleMovements: vi.fn(),
  inventoryUpdateMany: vi.fn(),
  movementCreate: vi.fn(),
  vendorOrderUpdateMany: vi.fn(),
  orderHistoryCreate: vi.fn(),
  vendorHistoryCreate: vi.fn(),
  redemptionDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  notificationCreate: vi.fn(),
  notify: vi.fn(),
  addCartItems: vi.fn(),
  transaction: vi.fn()
}));

const tx = {
  $queryRaw: vi.fn(),
  order: { findFirst: mocks.orderFindFirst, updateMany: mocks.orderUpdateMany },
  inventoryMovement: { findMany: mocks.saleMovements, create: mocks.movementCreate },
  inventory: { updateMany: mocks.inventoryUpdateMany },
  vendorOrder: { updateMany: mocks.vendorOrderUpdateMany },
  orderStatusHistory: { create: mocks.orderHistoryCreate },
  vendorOrderStatusHistory: { create: mocks.vendorHistoryCreate },
  couponRedemption: { deleteMany: mocks.redemptionDeleteMany },
  auditLog: { create: mocks.auditCreate },
  notification: { create: mocks.notificationCreate }
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
vi.mock("@/server/cart/cart", () => ({ addCartItems: mocks.addCartItems }));

import { cancelOwnedOrder, reorderOwnedOrder } from "@/server/orders/orders";

describe("customer order management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({ userId: "buyer-1" });
    mocks.orderFindFirst.mockResolvedValue({
      id: "order-1", orderNumber: "MTJ-ORDER-1", status: "PENDING_PAYMENT", userId: "buyer-1",
      payments: [], vendorOrders: [{ id: "vendor-1", status: "PENDING_PAYMENT" }]
    });
    mocks.saleMovements.mockResolvedValue([{ inventoryId: "inventory-1", quantityDelta: -2 }]);
    mocks.inventoryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.vendorOrderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  it("cancels unpaid orders, restores inventory, and releases coupon redemption transactionally", async () => {
    const result = await cancelOwnedOrder("", "order-1");

    expect(result).toMatchObject({ status: "CANCELLED", changed: true });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(mocks.inventoryUpdateMany).toHaveBeenCalledWith({
      where: { id: "inventory-1" }, data: { quantityOnHand: { increment: 2 } }
    });
    expect(mocks.movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "ORDER_CANCELLATION", quantityDelta: 2,
        idempotencyKey: "order-cancellation:order-1:inventory-1"
      })
    });
    expect(mocks.redemptionDeleteMany).toHaveBeenCalledWith({ where: { orderId: "order-1" } });
  });

  it("refuses cancellation once any payment attempt exists", async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: "order-1", orderNumber: "MTJ-ORDER-1", status: "PENDING_PAYMENT", userId: "buyer-1",
      payments: [{ id: "payment-1" }], vendorOrders: [{ id: "vendor-1", status: "PENDING_PAYMENT" }]
    });

    await expect(cancelOwnedOrder("", "order-1")).rejects.toThrow("payment attempt exists");
    expect(mocks.inventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it("reorders only the original order's still-linked product options", async () => {
    mocks.orderFindFirst.mockResolvedValue({
      marketId: "market-1", currencyCode: "EUR",
      vendorOrders: [{ items: [
        { variantId: "variant-1", quantity: 2 },
        { variantId: null, quantity: 1 }
      ] }]
    });
    mocks.addCartItems.mockResolvedValue({ cartId: "cart-1", itemCount: 1 });

    await expect(reorderOwnedOrder("", "order-1")).resolves.toEqual({ cartId: "cart-1", itemCount: 1 });
    expect(mocks.addCartItems).toHaveBeenCalledWith("", {
      marketId: "market-1", currencyCode: "EUR",
      items: [{ variantId: "variant-1", quantity: 2 }]
    }, expect.any(Date));
  });
});
