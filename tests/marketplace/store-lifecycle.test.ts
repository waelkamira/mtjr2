import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireCurrentSession: vi.fn(),
  transaction: vi.fn(),
  sellerFind: vi.fn(),
  marketFind: vi.fn(),
  roleFind: vi.fn(),
  storeCreate: vi.fn(),
  sellerUpdate: vi.fn(),
  roleAssignmentCreate: vi.fn(),
  auditCreate: vi.fn(),
  staffFind: vi.fn(),
  staffUpdate: vi.fn(),
  roleAssignmentUpsert: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { acceptStoreStaffInvitation, approveSellerAndCreateStore, inviteStoreStaff } from "@/server/marketplace/store-lifecycle";

describe("seller and store lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.requireCurrentSession.mockResolvedValue({ userId: "staff-1" });
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      seller: { findUnique: mocks.sellerFind, update: mocks.sellerUpdate },
      market: { findMany: mocks.marketFind },
      role: { findUnique: mocks.roleFind },
      store: { create: mocks.storeCreate, findUnique: mocks.sellerFind },
      user: { findUnique: mocks.sellerFind },
      userRoleAssignment: { create: mocks.roleAssignmentCreate, upsert: mocks.roleAssignmentUpsert },
      auditLog: { create: mocks.auditCreate },
      sellerStaff: { upsert: mocks.storeCreate, findUnique: mocks.staffFind, update: mocks.staffUpdate }
    }));
    mocks.sellerFind.mockResolvedValue({ id: "seller-1", ownerId: "owner-1", status: "PENDING" });
    mocks.marketFind.mockResolvedValue([{ id: "market-1", defaultCurrencyCode: "EUR", currencies: [{ currencyCode: "EUR" }] }]);
    mocks.roleFind.mockResolvedValue({ id: "role-1" });
    mocks.storeCreate.mockResolvedValue({ id: "store-1", name: "Shop", slug: "shop", status: "ACTIVE" });
    mocks.staffFind.mockResolvedValue({ id: "membership-1", userId: "staff-1", storeId: "store-1", status: "INVITED" });
    mocks.staffUpdate.mockResolvedValue({ id: "membership-1", storeId: "store-1", status: "ACTIVE" });
  });

  it("approves a pending seller and creates a market-linked store with scoped role and audit", async () => {
    const result = await approveSellerAndCreateStore({
      sellerId: "seller-1", storeName: "Shop", storeSlug: "shop", marketIds: ["market-1"]
    });
    expect(result.store.id).toBe("store-1");
    expect(mocks.roleAssignmentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "owner-1", scopeType: "STORE", scopeId: "store-1" })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects approval when the default market currency is disabled", async () => {
    mocks.marketFind.mockResolvedValue([{ id: "market-1", defaultCurrencyCode: "EUR", currencies: [] }]);
    await expect(approveSellerAndCreateStore({
      sellerId: "seller-1", storeName: "Shop", storeSlug: "shop", marketIds: ["market-1"]
    })).rejects.toThrow(/default currency/i);
    expect(mocks.storeCreate).not.toHaveBeenCalled();
  });

  it("invites staff only through a store-scoped permission check", async () => {
    mocks.sellerFind.mockResolvedValueOnce({ id: "store-1", status: "ACTIVE" }).mockResolvedValueOnce({ id: "staff-2", status: "ACTIVE" });
    mocks.storeCreate.mockResolvedValueOnce({ id: "membership-1", status: "INVITED", storeId: "store-1", userId: "staff-2" });
    const result = await inviteStoreStaff({ storeId: "store-1", userId: "staff-2" });
    expect(result.status).toBe("INVITED");
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.objectContaining({
      permissionKey: "store:staff:manage", scope: { type: "STORE", id: "store-1" }
    }));
  });

  it("lets only the invited user accept and receives the scoped manager role", async () => {
    const result = await acceptStoreStaffInvitation("membership-1");
    expect(result.status).toBe("ACTIVE");
    expect(mocks.roleAssignmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_roleId_scopeType_scopeId: {
        userId: "staff-1", roleId: "role-1", scopeType: "STORE", scopeId: "store-1"
      } }
    }));
  });

  it("rejects accepting another user's invitation", async () => {
    mocks.staffFind.mockResolvedValue({ id: "membership-1", userId: "someone-else", storeId: "store-1", status: "INVITED" });
    await expect(acceptStoreStaffInvitation("membership-1")).rejects.toThrow(/pending invitation/i);
    expect(mocks.roleAssignmentUpsert).not.toHaveBeenCalled();
  });
});
