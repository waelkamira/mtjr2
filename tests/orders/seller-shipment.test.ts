import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  permissionFindStaff: vi.fn(),
  roleFindMany: vi.fn(),
  vendorFindUnique: vi.fn(),
  vendorUpdateMany: vi.fn(),
  vendorFindMany: vi.fn(),
  shipmentCreate: vi.fn(),
  shipmentUpdate: vi.fn(),
  trackingEventCreate: vi.fn(),
  vendorHistoryCreate: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderHistoryCreate: vi.fn(),
  auditCreate: vi.fn(),
  notificationCreate: vi.fn(),
  transaction: vi.fn()
}));

const tx = {
  vendorOrder: {
    findUnique: mocks.vendorFindUnique, updateMany: mocks.vendorUpdateMany, findMany: mocks.vendorFindMany
  },
  sellerStaff: { findFirst: mocks.permissionFindStaff },
  userRoleAssignment: { findMany: mocks.roleFindMany },
  shipment: { create: mocks.shipmentCreate, update: mocks.shipmentUpdate },
  shipmentTrackingEvent: { create: mocks.trackingEventCreate },
  vendorOrderStatusHistory: { create: mocks.vendorHistoryCreate },
  order: { findUniqueOrThrow: mocks.orderFindUnique, updateMany: mocks.orderUpdateMany },
  orderStatusHistory: { create: mocks.orderHistoryCreate },
  auditLog: { create: mocks.auditCreate },
  notification: { create: mocks.notificationCreate }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-guard", () => ({
  PermissionDeniedError: class PermissionDeniedError extends Error {
    constructor() { super("You do not have permission to perform this action."); }
  }
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: vi.fn(), userHasScopedPermission: vi.fn()
}));

import { addSellerShipmentTrackingEvent, createSellerShipment } from "@/server/orders/seller-orders";

describe("seller shipment tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.vendorFindUnique.mockResolvedValue({
      id: "vendor-1", orderId: "order-1", storeId: "store-1", status: "READY_TO_SHIP",
      shipment: null, order: { orderNumber: "MTJ-ORDER-1", userId: "buyer-1" },
      store: { status: "ACTIVE", seller: { ownerId: "seller-1", status: "ACTIVE" } }
    });
    mocks.shipmentCreate.mockResolvedValue({ id: "shipment-1", status: "SHIPPED" });
    mocks.vendorUpdateMany.mockResolvedValue({ count: 1 });
    mocks.orderFindUnique.mockResolvedValue({ status: "PROCESSING" });
    mocks.vendorFindMany.mockResolvedValue([{ status: "SHIPPED" }]);
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  it("creates a shipment and moves a ready seller order into fulfillment", async () => {
    await createSellerShipment("vendor-1", {
      carrierName: "Example Carrier", trackingNumber: "TRACK-123", trackingUrl: "https://carrier.example/track/123"
    });

    expect(mocks.shipmentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "SHIPPED", vendorOrderId: "vendor-1",
        events: { create: expect.objectContaining({ status: "SHIPPED", actorId: "seller-1" }) }
      })
    }));
    expect(mocks.vendorUpdateMany).toHaveBeenCalledWith({
      where: { id: "vendor-1", status: "READY_TO_SHIP" }, data: { status: "SHIPPED" }
    });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "PROCESSING" }, data: { status: "FULFILLED" }
    });
  });

  it("rejects insecure tracking URLs before opening a database transaction", async () => {
    await expect(createSellerShipment("vendor-1", {
      carrierName: "Example Carrier", trackingNumber: "TRACK-123", trackingUrl: "http://carrier.example/track/123"
    })).rejects.toThrow("HTTPS");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies shipment creation to staff without orders:manage for the store", async () => {
    mocks.vendorFindUnique.mockResolvedValue({
      id: "vendor-1", orderId: "order-1", storeId: "store-1", status: "READY_TO_SHIP",
      shipment: null, order: { orderNumber: "MTJ-ORDER-1", userId: "buyer-1" },
      store: { status: "ACTIVE", seller: { ownerId: "another-seller", status: "ACTIVE" } }
    });
    mocks.permissionFindStaff.mockResolvedValue(null);
    mocks.roleFindMany.mockResolvedValue([]);

    await expect(createSellerShipment("vendor-1", {
      carrierName: "Example Carrier", trackingNumber: "TRACK-123"
    })).rejects.toThrow("do not have permission");
    expect(mocks.shipmentCreate).not.toHaveBeenCalled();
  });

  it("records delivery and completes the parent order when all seller orders are delivered", async () => {
    mocks.vendorFindUnique.mockResolvedValue({
      id: "vendor-1", orderId: "order-1", storeId: "store-1", status: "SHIPPED",
      shipment: { id: "shipment-1", status: "OUT_FOR_DELIVERY" },
      order: { orderNumber: "MTJ-ORDER-1", userId: "buyer-1" },
      store: { status: "ACTIVE", seller: { ownerId: "seller-1", status: "ACTIVE" } }
    });
    mocks.vendorFindMany.mockResolvedValue([{ status: "DELIVERED" }]);
    mocks.orderFindUnique.mockResolvedValue({ status: "FULFILLED" });

    await addSellerShipmentTrackingEvent("vendor-1", { status: "DELIVERED", location: "Amsterdam" });

    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: "shipment-1" },
      data: { status: "DELIVERED", deliveredAt: expect.any(Date) }
    });
    expect(mocks.vendorUpdateMany).toHaveBeenCalledWith({
      where: { id: "vendor-1", status: "SHIPPED" }, data: { status: "DELIVERED" }
    });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "FULFILLED" }, data: { status: "COMPLETED" }
    });
  });

  it("rejects tracking updates that skip required forward stages", async () => {
    mocks.vendorFindUnique.mockResolvedValue({
      id: "vendor-1", orderId: "order-1", storeId: "store-1", status: "SHIPPED",
      shipment: { id: "shipment-1", status: "SHIPPED" },
      order: { orderNumber: "MTJ-ORDER-1", userId: "buyer-1" },
      store: { status: "ACTIVE", seller: { ownerId: "seller-1", status: "ACTIVE" } }
    });

    await expect(addSellerShipmentTrackingEvent("vendor-1", { status: "DELIVERED" }))
      .rejects.toThrow("cannot move");
    expect(mocks.shipmentUpdate).not.toHaveBeenCalled();
  });
});
