import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  transaction: vi.fn(),
  storeFind: vi.fn(),
  userFind: vi.fn(),
  membershipUpsert: vi.fn(),
  membershipFind: vi.fn(),
  membershipUpdateMany: vi.fn(),
  roleFind: vi.fn(),
  roleUpsert: vi.fn(),
  roleDeleteMany: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission: mocks.userHasScopedPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { acceptStoreStaffInvitation, inviteStoreStaff, revokeStoreStaff } from "@/server/marketplace/store-staff";

describe("store staff lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.storeFind.mockResolvedValue({ id: "store-1", seller: { ownerId: "owner-1", status: "ACTIVE" } });
    mocks.userFind.mockResolvedValue({ id: "staff-1", status: "ACTIVE" });
    mocks.membershipUpsert.mockResolvedValue({ id: "membership-1", status: "INVITED" });
    mocks.membershipFind.mockResolvedValue({ id: "membership-1", userId: "staff-1", storeId: "store-1", status: "INVITED", store: { seller: { status: "ACTIVE" } } });
    mocks.membershipUpdateMany.mockResolvedValue({ count: 1 });
    mocks.roleFind.mockResolvedValue({ id: "manager-role" });
    mocks.roleUpsert.mockResolvedValue({});
    mocks.roleDeleteMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      store: { findUnique: mocks.storeFind },
      user: { findUnique: mocks.userFind },
      sellerStaff: { upsert: mocks.membershipUpsert, findUnique: mocks.membershipFind, updateMany: mocks.membershipUpdateMany },
      role: { findUnique: mocks.roleFind },
      userRoleAssignment: { upsert: mocks.roleUpsert, deleteMany: mocks.roleDeleteMany },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("allows the store owner to invite an active account", async () => {
    const result = await inviteStoreStaff({ storeId: "store-1", userId: "staff-1" });
    expect(result.status).toBe("INVITED");
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("requires the store owner for team management", async () => {
    mocks.requireCurrentSession.mockResolvedValue({ userId: "manager-1" });
    await expect(inviteStoreStaff({ storeId: "store-1", userId: "staff-1" })).rejects.toThrow(/Only the store owner can invite or revoke team members/i);
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("grants STORE_MANAGER only after the invited user accepts", async () => {
    mocks.requireCurrentSession.mockResolvedValue({ userId: "staff-1" });
    const result = await acceptStoreStaffInvitation("membership-1");
    expect(result.status).toBe("ACTIVE");
    expect(mocks.roleUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_roleId_scopeType_scopeId: {
        userId: "staff-1", roleId: "manager-role", scopeType: "STORE", scopeId: "store-1"
      } }
    }));
  });

  it("rejects acceptance by a different account", async () => {
    mocks.requireCurrentSession.mockResolvedValue({ userId: "other-user" });
    await expect(acceptStoreStaffInvitation("membership-1")).rejects.toThrow(/invitation not found/i);
    expect(mocks.roleUpsert).not.toHaveBeenCalled();
  });
  it("lets the store owner revoke staff membership and its scoped role grant", async () => {
    const result = await revokeStoreStaff("membership-1");
    expect(result).toBe(true);
    expect(mocks.membershipUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.roleDeleteMany).toHaveBeenCalledWith({
      where: { userId: "staff-1", roleId: "manager-role", scopeType: "STORE", scopeId: "store-1" }
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("does not allow a delegated manager to grant another manager role", async () => {
    mocks.requireCurrentSession.mockResolvedValue({ userId: "manager-1" });
    mocks.userHasScopedPermission.mockResolvedValue(true);
    await expect(inviteStoreStaff({ storeId: "store-1", userId: "staff-1" }))
      .rejects.toThrow(/Only the store owner can invite or revoke team members/i);
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
    expect(mocks.userHasScopedPermission).not.toHaveBeenCalled();
  });

});
