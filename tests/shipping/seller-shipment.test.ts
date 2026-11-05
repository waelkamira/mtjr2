import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  vendorOrderFindUnique: vi.fn(),
  shipmentCreate: vi.fn(),
  vendorOrderUpdateMany: vi.fn(),
  vendorOrderStatusHistoryCreate: vi.fn(),
  vendorOrderFindMany: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderStatusHistoryCreate: vi.fn(),
  auditCreate: vi.fn(),
  sellerStaffFindFirst: vi.fn(),
  roleAssignmentFindMany: vi.fn()
}));

const tx = {
  vendorOrder: { findUnique: mocks.vendorOrderFindUnique, updateMany: mocks.vendorOrderUpdateMany, findMany: mocks.vendorOrderFindMany },
  shipment: { create: mocks.shipmentCreate },
  vendorOrderStatusHistory: { create: mocks.vendorOrderStatusHistoryCreate },
  order: { updateMany: mocks.orderUpdateMany },
  orderStatusHistory: { create: mocks.orderStatusHistoryCreate },
  auditLog: { create: mocks.auditCreate },
  sellerStaff: { findFirst: mocks.sellerStaffFindFirst },
  userRoleAssignment: { findMany: mocks.roleAssignmentFindMany }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) }
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));

import { createSellerShipment } from "@/server/orders/seller-orders";

const readyOrder = {
  id: "vendor-1", orderId: "order-1", storeId: "store-1", status: "READY_TO_SHIP",
  shipment: null, order: { status: "PROCESSING", orderNumber: "MTJ-1" },
  store: { status: "ACTIVE", seller: { ownerId: "owner-1", status: "ACTIVE" } }
};

describe("seller shipment dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.vendorOrderFindUnique.mockResolvedValue(readyOrder);
    mocks.shipmentCreate.mockImplementation(async ({ data }) => ({ id: "shipment-1", ...data }));
    mocks.vendorOrderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.vendorOrderStatusHistoryCreate.mockResolvedValue({});
    mocks.vendorOrderFindMany.mockResolvedValue([{ status: "SHIPPED" }]);
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.orderStatusHistoryCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.sellerStaffFindFirst.mockResolvedValue(null);
    mocks.roleAssignmentFindMany.mockResolvedValue([]);
  });

  it("records dispatch, transitions vendor order and audits the action", async () => {
    const result = await createSellerShipment("vendor-1", {
      carrierName: "DHL", trackingNumber: "TRACK-123", trackingUrl: "https://tracking.example.test/TRACK-123"
    }, new Date("2026-11-05T10:00:00.000Z"));

    expect(result).toMatchObject({ id: "shipment-1", vendorOrderStatus: "SHIPPED", changed: true });
    expect(mocks.shipmentCreate).toHaveBeenCalledOnce();
    expect(mocks.vendorOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "vendor-1", storeId: "store-1", status: "READY_TO_SHIP" },
      data: { status: "SHIPPED" }
    }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("fulfills the parent order when every non-cancelled vendor order is dispatched", async () => {
    mocks.vendorOrderFindMany.mockResolvedValue([
      { status: "SHIPPED" },
      { status: "CANCELLED" }
    ]);

    await createSellerShipment("vendor-1", {
      carrierName: "DHL", trackingNumber: "TRACK-123"
    });

    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1", status: "PROCESSING" },
      data: { status: "FULFILLED" }
    }));
    expect(mocks.orderStatusHistoryCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FULFILLED" })
    }));
  });

  it("keeps a multi-vendor parent partially fulfilled while a live vendor order remains undispatched", async () => {
    mocks.vendorOrderFindMany.mockResolvedValue([
      { status: "SHIPPED" },
      { status: "READY_TO_SHIP" },
      { status: "CANCELLED" }
    ]);

    await createSellerShipment("vendor-1", {
      carrierName: "DHL", trackingNumber: "TRACK-123"
    });

    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1", status: "PROCESSING" },
      data: { status: "PARTIALLY_FULFILLED" }
    }));
  });

  it("rejects non-HTTPS tracking URLs before database writes", async () => {
    await expect(createSellerShipment("vendor-1", {
      carrierName: "DHL", trackingNumber: "TRACK-123", trackingUrl: "http://tracking.example.test/TRACK-123"
    })).rejects.toThrow();
    expect(mocks.shipmentCreate).not.toHaveBeenCalled();
  });

  it("rejects cross-store staff without the exact store permission", async () => {
    mocks.requireCurrentSession.mockResolvedValue({ userId: "staff-2" });
    await expect(createSellerShipment("vendor-1", {
      carrierName: "DHL", trackingNumber: "TRACK-123"
    })).rejects.toThrow("You do not have permission to perform this action.");
    expect(mocks.shipmentCreate).not.toHaveBeenCalled();
  });

  it("returns the existing shipment on an identical dispatch retry", async () => {
    mocks.vendorOrderFindUnique.mockResolvedValue({
      ...readyOrder, status: "SHIPPED",
      shipment: { id: "shipment-1", carrierName: "DHL", trackingNumber: "TRACK-123", trackingUrl: null, shippedAt: new Date("2026-11-05T10:00:00.000Z") }
    });
    const result = await createSellerShipment("vendor-1", { carrierName: "DHL", trackingNumber: "TRACK-123" });
    expect(result).toMatchObject({ id: "shipment-1", vendorOrderStatus: "SHIPPED", changed: false });
    expect(mocks.shipmentCreate).not.toHaveBeenCalled();
  });
});
