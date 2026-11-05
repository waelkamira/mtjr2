import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasPermission: vi.fn(),
  userHasScopedPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  staffFindFirst: vi.fn(),
  returnFindUnique: vi.fn(),
  returnItemUpdateMany: vi.fn(),
  returnItemFindMany: vi.fn(),
  returnRequestUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    store: { findUnique: mocks.storeFindUnique },
      sellerStaff: { findFirst: mocks.staffFindFirst },
    returnRequest: { findUnique: mocks.returnFindUnique },
    returnItem: { updateMany: mocks.returnItemUpdateMany, findMany: mocks.returnItemFindMany },
    auditLog: { create: mocks.auditCreate }
  }
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: mocks.userHasPermission,
  userHasScopedPermission: mocks.userHasScopedPermission
}));

import { reviewSellerReturnItems } from "@/server/returns/seller-returns";

describe("store-scoped seller return decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-a" });
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.storeFindUnique.mockResolvedValue({ id: "store-a", status: "ACTIVE", seller: { ownerId: "seller-a", status: "ACTIVE" } });
    mocks.staffFindFirst.mockResolvedValue(null);
    mocks.returnFindUnique.mockResolvedValue({ id: "return-1", status: "REQUESTED", returnNumber: "RET-1", orderId: "order-1" });
    mocks.returnItemUpdateMany.mockResolvedValue({ count: 2 });
    mocks.returnItemFindMany.mockResolvedValue([{ status: "APPROVED" }, { status: "APPROVED" }, { status: "REQUESTED" }]);
    mocks.returnRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    const tx = {
      store: { findUnique: mocks.storeFindUnique },
      sellerStaff: { findFirst: mocks.staffFindFirst },
      returnRequest: { findUnique: mocks.returnFindUnique, updateMany: mocks.returnRequestUpdateMany },
      returnItem: { updateMany: mocks.returnItemUpdateMany, findMany: mocks.returnItemFindMany },
      auditLog: { create: mocks.auditCreate }
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("updates only the selected store's pending lines and keeps the parent pending while another store is undecided", async () => {
    const result = await reviewSellerReturnItems("return-1", { storeId: "store-a", status: "APPROVED", note: "Checked" }, new Date("2026-11-05T00:00:00Z"));

    expect(mocks.returnItemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        returnRequestId: "return-1",
        status: "REQUESTED",
        orderItem: { vendorOrder: { storeId: "store-a" } }
      }),
      data: expect.objectContaining({ status: "APPROVED", reviewNote: "Checked", reviewedById: "seller-a" })
    }));
    expect(result).toMatchObject({ status: "REQUESTED", affectedItems: 2, changed: true });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects a user who does not own or have scoped permission for the selected store", async () => {
    mocks.storeFindUnique.mockResolvedValue({ id: "store-b", status: "ACTIVE", seller: { ownerId: "seller-b", status: "ACTIVE" } });

    await expect(reviewSellerReturnItems("return-1", { storeId: "store-b", status: "REJECTED" }))
      .rejects.toThrow("Permission denied.");
    expect(mocks.returnItemUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });


  it("allows explicitly scoped active staff to decide their store's lines", async () => {
    mocks.storeFindUnique.mockResolvedValue({ id: "store-b", status: "ACTIVE", seller: { ownerId: "seller-b", status: "ACTIVE" } });
    mocks.staffFindFirst.mockResolvedValue({ id: "staff-membership" });
    mocks.userHasScopedPermission.mockResolvedValue(true);

    const result = await reviewSellerReturnItems("return-1", { storeId: "store-b", status: "APPROVED" });

    expect(mocks.userHasScopedPermission).toHaveBeenCalledWith("seller-a", {
      permissionKey: "orders:manage", scope: { type: "STORE", id: "store-b" }, now: expect.any(Date)
    });
    expect(mocks.returnItemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderItem: { vendorOrder: { storeId: "store-b" } } })
    }));
    expect(result.changed).toBe(true);
  });

  it("treats a repeated identical decision as an idempotent no-op", async () => {
    mocks.returnItemUpdateMany.mockResolvedValue({ count: 0 });
    mocks.returnItemFindMany.mockResolvedValue([{ status: "APPROVED" }, { status: "APPROVED" }]);

    const result = await reviewSellerReturnItems("return-1", { storeId: "store-a", status: "APPROVED" });

    expect(result).toMatchObject({ status: "REQUESTED", affectedItems: 0, changed: false });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("marks the parent rejected only when every return line has been rejected", async () => {
    mocks.returnItemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.returnItemFindMany.mockResolvedValue([{ status: "REJECTED" }, { status: "REJECTED" }]);

    const result = await reviewSellerReturnItems("return-1", { storeId: "store-a", status: "REJECTED" });

    expect(result.status).toBe("REJECTED");
    expect(mocks.returnRequestUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "return-1", status: "REQUESTED" },
      data: expect.objectContaining({ status: "REJECTED" })
    }));
  });
});
