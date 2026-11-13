import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  returnRequestFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { returnRequest: { findMany: mocks.returnRequestFindMany } }
}));

import { listReturnRequestsForAdmin } from "@/server/returns/returns";

describe("admin return queue store context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.returnRequestFindMany.mockResolvedValue([{
      id: "return-1",
      returnNumber: "RET-1",
      order: { orderNumber: "MTJ-100" },
      customer: { id: "customer-1", displayName: "Customer", email: "customer@example.test" },
      status: "REQUESTED",
      reasonCode: "DAMAGED",
      reasonDetails: null,
      reviewNote: null,
      requestedAt: new Date("2026-11-13T00:00:00.000Z"),
      reviewedAt: null,
      items: [{
        quantity: 1,
        orderItem: {
          productName: "Desk lamp",
          sku: "LAMP-1",
          quantity: 2,
          vendorOrder: { store: { name: "Damascus Home" } }
        }
      }]
    }]);
  });

  it("loads each item's owning store and returns its name for cross-store review context", async () => {
    const now = new Date("2026-11-13T10:00:00.000Z");
    const result = await listReturnRequestsForAdmin(now);

    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "returns:manage", now });
    expect(mocks.returnRequestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        items: {
          include: {
            orderItem: {
              select: expect.objectContaining({
                productName: true,
                sku: true,
                quantity: true,
                vendorOrder: { select: { store: { select: { name: true } } } }
              })
            }
          }
        }
      })
    }));
    expect(result[0].items[0]).toEqual({
      productName: "Desk lamp",
      sku: "LAMP-1",
      storeName: "Damascus Home",
      orderedQuantity: 2,
      quantity: 1
    });
  });
});
