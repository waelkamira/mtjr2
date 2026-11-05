import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  userCount: vi.fn(),
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      count: mocks.userCount,
      findMany: mocks.userFindMany,
      findUnique: mocks.userFindUnique
    },
    $transaction: mocks.transaction
  }
}));

import { changeAdminUserStatus, listAdminUsers } from "@/server/admin/users";

describe("admin user management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.userCount.mockResolvedValue(1);
    mocks.userFindMany.mockResolvedValue([{
      id: "buyer-1", email: "buyer@example.test", displayName: "Buyer", status: "ACTIVE",
      lastLoginAt: null, createdAt: new Date("2026-01-01T00:00:00Z"),
      _count: { orders: 2, sessions: 1, roleAssignments: 1 }
    }]);
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      user: {
        findUnique: mocks.userFindUnique,
        updateMany: mocks.userUpdateMany
      },
      userSession: { updateMany: mocks.sessionUpdateMany },
      auditLog: { create: mocks.auditCreate }
    }));
    mocks.userFindUnique.mockResolvedValue({ id: "buyer-1", status: "ACTIVE", roleAssignments: [] });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 2 });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("searches and paginates only behind the users:manage permission", async () => {
    const result = await listAdminUsers({ q: "Buyer", status: "ACTIVE", page: "2", limit: "10" });

    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage", now: expect.any(Date) });
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({ status: "ACTIVE" })
    }));
    expect(result).toMatchObject({ page: 2, limit: 10, total: 1, pageCount: 1 });
    expect(result.items[0].orderCount).toBe(2);
  });

  it("suspends an account, revokes sessions, and audits the reason atomically", async () => {
    const now = new Date("2026-11-05T00:00:00Z");
    const result = await changeAdminUserStatus("buyer-1", {
      status: "SUSPENDED",
      reason: "Confirmed account abuse"
    }, now);

    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "buyer-1", status: "ACTIVE" },
      data: { status: "SUSPENDED" }
    });
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "buyer-1", revokedAt: null },
      data: { revokedAt: now }
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "identity.user.status_changed",
        resourceId: "buyer-1",
        occurredAt: now,
        metadata: expect.objectContaining({
          previousStatus: "ACTIVE",
          status: "SUSPENDED",
          reason: "Confirmed account abuse",
          revokedSessions: 2
        })
      })
    }));
    expect(result).toMatchObject({ previousStatus: "ACTIVE", status: "SUSPENDED", revokedSessions: 2 });
  });

  it("does not allow status changes to self or a super administrator", async () => {
    await expect(changeAdminUserStatus("admin-1", { status: "SUSPENDED", reason: "reason" }))
      .rejects.toThrow("cannot change their own");
    mocks.userFindUnique.mockResolvedValue({
      id: "buyer-1", status: "ACTIVE", roleAssignments: [{ id: "role-1" }]
    });
    await expect(changeAdminUserStatus("buyer-1", { status: "SUSPENDED", reason: "reason" }))
      .rejects.toThrow("Super administrator accounts cannot be changed");
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
