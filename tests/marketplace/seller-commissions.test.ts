import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentSession, userHasScopedPermission, storeFindUnique, commissionFindMany } = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  commissionFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { store: { findUnique: storeFindUnique }, commissionTransaction: { findMany: commissionFindMany } }
}));

import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { getSellerCommissionHistory } from "@/server/marketplace/seller-commissions";

describe("seller commission snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    storeFindUnique.mockResolvedValue({ id: "store-1", name: "Shop", sellerId: "seller-1", seller: { ownerId: "owner-1" } });
    commissionFindMany.mockResolvedValue([{
      id: "commission-1", orderId: "order-1", vendorOrderId: "vendor-1", categoryName: "Home",
      rateBasisPoints: 750, baseAmountMinor: BigInt(10000), commissionMinor: BigInt(750), currencyCode: "USD",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      order: { orderNumber: "MTJ-1001", status: "CONFIRMED" },
      orderItem: { productName: "Desk lamp", sku: "LAMP-01", quantity: 2 },
      currency: { minorUnit: 2 }
    }]);
  });

  it("returns only the selected seller store's immutable commission snapshots", async () => {
    const result = await getSellerCommissionHistory("store-1");
    expect(storeFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "store-1" } }));
    expect(commissionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { storeId: "store-1", sellerId: "seller-1" }, take: 100
    }));
    expect(result.totals[0]).toMatchObject({
      currencyCode: "USD", baseAmountMinor: "10000", commissionMinor: "750", transactionCount: 1
    });
    expect(result.transactions[0]).toMatchObject({
      orderNumber: "MTJ-1001", productName: "Desk lamp", rateBasisPoints: 750
    });
  });

  it("requires an exact store-scoped orders:read grant for non-owners", async () => {
    requireCurrentSession.mockResolvedValue({ userId: "staff-1" });
    storeFindUnique.mockResolvedValue({
      id: "store-1", name: "Shop", sellerId: "seller-1", seller: { ownerId: "owner-1" }
    });
    userHasScopedPermission.mockResolvedValue(false);
    await expect(getSellerCommissionHistory("store-1")).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(commissionFindMany).not.toHaveBeenCalled();
  });
});
