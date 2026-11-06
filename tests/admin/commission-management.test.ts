import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformManagement: vi.fn(),
  transaction: vi.fn(),
  advisoryLock: vi.fn(),
  findConflictingRule: vi.fn(),
  createRule: vi.fn(),
  findRule: vi.fn(),
  updateRule: vi.fn(),
  createAudit: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePlatformManagement: mocks.requirePlatformManagement
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

import { createCommissionRule, deactivateCommissionRule } from "@/server/admin/commission-management";

const tx = {
  $queryRaw: mocks.advisoryLock,
  commissionRule: {
    findFirst: mocks.findConflictingRule,
    create: mocks.createRule,
    findUnique: mocks.findRule,
    updateMany: mocks.updateRule
  },
  auditLog: { create: mocks.createAudit }
};

describe("commission management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "admin-1" });
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
    mocks.findConflictingRule.mockResolvedValue(null);
    mocks.createRule.mockResolvedValue({ id: "rule-1" });
    mocks.findRule.mockResolvedValue({
      id: "rule-1", sellerId: null, categoryId: null, isActive: true
    });
    mocks.updateRule.mockResolvedValue({ count: 1 });
    mocks.createAudit.mockResolvedValue({});
  });

  it("creates and audits an effective global rule", async () => {
    const effectiveFrom = new Date("2026-11-06T12:00:00.000Z");
    await expect(createCommissionRule({
      scope: "GLOBAL", rateBasisPoints: 500, effectiveFrom
    })).resolves.toEqual({ id: "rule-1" });

    expect(mocks.findConflictingRule).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sellerId: null, categoryId: null, isActive: true })
    }));
    expect(mocks.createRule).toHaveBeenCalledWith({
      data: {
        sellerId: null, categoryId: null, rateBasisPoints: 500, effectiveFrom,
        effectiveUntil: null, createdById: "admin-1"
      },
      select: { id: true }
    });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "finance.commission_rule.created",
        resourceId: "rule-1",
        actorId: "admin-1"
      })
    }));
  });

  it("rejects overlapping active rules without creating another rule", async () => {
    mocks.findConflictingRule.mockResolvedValue({ id: "existing-rule" });
    await expect(createCommissionRule({
      scope: "GLOBAL", rateBasisPoints: 700, effectiveFrom: new Date("2026-11-06T12:00:00.000Z")
    })).rejects.toThrow("already covers");
    expect(mocks.createRule).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("deactivates with a reason and writes an audit event", async () => {
    await expect(deactivateCommissionRule("rule-1", "Policy update")).resolves.toEqual({
      id: "rule-1", isActive: false
    });
    expect(mocks.updateRule).toHaveBeenCalledWith({
      where: { id: "rule-1", isActive: true },
      data: { isActive: false, deactivatedAt: expect.any(Date) }
    });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "finance.commission_rule.deactivated",
        metadata: { reason: "Policy update" }
      })
    }));
  });
});
