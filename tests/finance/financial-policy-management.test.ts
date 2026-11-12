import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformManagement: vi.fn(),
  versionFindMany: vi.fn(),
  versionFindUnique: vi.fn(),
  versionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePlatformManagement: mocks.requirePlatformManagement
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    financialPolicyRuleVersion: {
      findMany: mocks.versionFindMany,
      findUnique: mocks.versionFindUnique,
      update: mocks.versionUpdate
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction
  }
}));

import { previewFinancialPolicyResolution, transitionFinancialPolicyVersion } from "@/server/admin/financial-policy-management";

const now = new Date("2026-11-12T12:00:00.000Z");
const context = {
  domain: "SELLER_PAYOUT_RELEASE",
  countryCode: "FR",
  subdivisionCode: "GES",
  marketCode: "MARKET-FR",
  currencyCode: "EUR",
  productClass: "STANDARD",
  paymentProvider: "BANK_TRANSFER",
  sellerId: "seller-1"
};

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy-version-1",
    version: 1,
    classification: "LEGAL",
    approvalStatus: "APPROVED",
    countryCode: "FR",
    subdivisionCode: null,
    marketCode: null,
    currencyCode: null,
    productClass: null,
    paymentProvider: null,
    sellerId: null,
    priority: 0,
    value: { holdDays: 30 },
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: null,
    sourceReference: "https://example.test/legal-source",
    reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
    reviewedById: "reviewer-1",
    approvedAt: new Date("2026-01-03T00:00:00.000Z"),
    approvedById: "approver-1",
    ...overrides
  };
}

describe("financial policy resolution preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "admin-1" });
    mocks.versionFindMany.mockResolvedValue([version()]);
    mocks.versionFindUnique.mockResolvedValue({
      ...version({ id: "version-to-approve", reviewedAt: new Date("2026-11-10T10:00:00.000Z"), reviewedById: "reviewer-1" }),
      createdById: "author-1",
      rule: { key: "SELLER_PAYOUT.HOLD_DAYS", domain: context.domain }
    });
    mocks.versionUpdate.mockResolvedValue({
      id: "version-to-approve", approvalStatus: "APPROVED",
      reviewedAt: new Date("2026-11-10T10:00:00.000Z"), reviewedById: "reviewer-1",
      approvedAt: now, approvedById: "approver-1"
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      financialPolicyRuleVersion: { findUnique: mocks.versionFindUnique, update: mocks.versionUpdate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("loads effective versions for the requested domain and returns the selected policy", async () => {
    const result = await previewFinancialPolicyResolution(context, now);

    expect(mocks.requirePlatformManagement).toHaveBeenCalledWith(now);
    expect(mocks.versionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        rule: { domain: context.domain },
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }]
      })
    }));
    expect(result.resolution.status).toBe("APPLICABLE");
    if (result.resolution.status === "APPLICABLE") {
      expect(result.resolution.rule.id).toBe("policy-version-1");
      expect(result.resolution.rule.value).toEqual({ holdDays: 30 });
    }
  });

  it("does not fall back to a platform rule when the winning legal rule is pending", async () => {
    mocks.versionFindMany.mockResolvedValue([
      version({ id: "legal-pending", approvalStatus: "PENDING_REVIEW", approvedAt: null, approvedById: null }),
      version({
        id: "platform-default",
        classification: "PLATFORM",
        countryCode: null,
        value: { holdDays: 7 }
      })
    ]);

    const result = await previewFinancialPolicyResolution(context, now);

    expect(result.resolution.status).toBe("REVIEW_REQUIRED");
  });

  it("does not query policy records when platform permission is denied", async () => {
    mocks.requirePlatformManagement.mockRejectedValue(new Error("Permission denied."));

    await expect(previewFinancialPolicyResolution(context, now)).rejects.toThrow("Permission denied.");
    expect(mocks.versionFindMany).not.toHaveBeenCalled();
  });

  it("keeps review notes immutable when a separate approver approves a legal policy", async () => {
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "approver-1" });

    await transitionFinancialPolicyVersion("version-to-approve", {
      action: "APPROVE",
      notes: "Approval evidence recorded."
    }, now);

    const updateCall = mocks.versionUpdate.mock.calls[0][0];
    expect(updateCall.data).toEqual({
      approvalStatus: "APPROVED",
      approvedAt: now,
      approvedById: "approver-1"
    });
    expect(updateCall.data).not.toHaveProperty("reviewNotes");
    expect(mocks.auditCreate.mock.calls[0][0].data.metadata.notes).toBe("Approval evidence recorded.");
  });

  it("rejects approval by the same person who reviewed a legal policy", async () => {
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "reviewer-1" });

    await expect(transitionFinancialPolicyVersion("version-to-approve", {
      action: "APPROVE"
    }, now)).rejects.toThrow("Legal policy approval requires a separate completed review.");

    expect(mocks.versionUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed currency and country context before querying the database", async () => {
    await expect(previewFinancialPolicyResolution({ ...context, currencyCode: "EURO" }, now)).rejects.toThrow();
    expect(mocks.versionFindMany).not.toHaveBeenCalled();
  });
});
