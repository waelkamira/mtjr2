import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  shipmentCount: vi.fn(),
  shipmentFindMany: vi.fn(),
  shipmentFindUnique: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    shipment: {
      count: mocks.shipmentCount,
      findMany: mocks.shipmentFindMany,
      findUnique: mocks.shipmentFindUnique
    }
  }
}));

import { getAdminShipment, listAdminShipments } from "@/server/admin/logistics";

const date = new Date("2026-11-05T12:00:00Z");
const order = {
  id: "order-1", orderNumber: "MTJ-1", status: "PROCESSING", placedAt: date,
  currencyCode: "USD", address: { countryCode: "US", countryName: "United States" }
};

describe("admin shipment operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.shipmentCount.mockResolvedValue(1);
    mocks.shipmentFindMany.mockResolvedValue([{
      id: "shipment-1", carrierName: "Carrier", trackingNumber: "TRACK-1",
      trackingUrl: "https://carrier.example/track/1", status: "IN_TRANSIT",
      shippedAt: date, deliveredAt: null,
      vendorOrder: { id: "vendor-order-1", status: "SHIPPED", store: { id: "store-1", name: "Store", slug: "store" }, order },
      events: [{ status: "IN_TRANSIT", description: null, location: "Hub", occurredAt: date }]
    }]);
  });

  it("lists persisted shipments behind admin permission and sanitizes unsafe tracking links", async () => {
    mocks.shipmentFindMany.mockResolvedValueOnce([{
      id: "shipment-1", carrierName: "Carrier", trackingNumber: "TRACK-1",
      trackingUrl: "javascript:alert(1)", status: "IN_TRANSIT", shippedAt: date,
      deliveredAt: null,
      vendorOrder: { id: "vendor-order-1", status: "SHIPPED", store: { id: "store-1", name: "Store", slug: "store" }, order },
      events: [{ status: "IN_TRANSIT", description: null, location: "Hub", occurredAt: date }]
    }]);

    const result = await listAdminShipments({ q: "TRACK", status: "IN_TRANSIT", page: "2", limit: "10" });

    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage", now: expect.any(Date) });
    expect(mocks.shipmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({ status: "IN_TRANSIT" })
    }));
    expect(result.items[0].trackingUrl).toBeNull();
    expect(result.items[0].vendorOrder.order.placedAt).toBe(date.toISOString());
  });

  it("returns the persisted shipment event timeline and sanitized HTTPS tracking URL", async () => {
    mocks.shipmentFindUnique.mockResolvedValue({
      id: "shipment-1", carrierName: "Carrier", trackingNumber: "TRACK-1",
      trackingUrl: "https://carrier.example/track/1", status: "DELIVERED",
      shippedAt: date, deliveredAt: date, createdAt: date, updatedAt: date,
      vendorOrder: { id: "vendor-order-1", status: "DELIVERED", store: { id: "store-1", name: "Store", slug: "store" }, order },
      events: [{ id: "event-1", status: "DELIVERED", description: "Delivered", location: "Door", occurredAt: date, actorId: null }]
    });

    const result = await getAdminShipment("shipment-1");

    expect(result.trackingUrl).toBe("https://carrier.example/track/1");
    expect(result.events[0].occurredAt).toBe(date.toISOString());
    expect(result.vendorOrder.order.orderNumber).toBe("MTJ-1");
  });

  it("does not query shipment data when permission is denied", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Permission denied."));

    await expect(listAdminShipments({})).rejects.toThrow("Permission denied.");
    expect(mocks.shipmentCount).not.toHaveBeenCalled();
    expect(mocks.shipmentFindMany).not.toHaveBeenCalled();
  });
});
