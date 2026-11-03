import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentSession, sellerFindUnique, sellerCreate, auditCreate, transaction } = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  sellerFindUnique: vi.fn(),
  sellerCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    seller: { findUnique: sellerFindUnique },
    $transaction: transaction
  }
}));

import { submitSellerApplication } from "@/server/marketplace/seller-application";

describe("submitSellerApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({
      userId: "user-1",
      user: { emailVerifiedAt: new Date("2026-01-01T00:00:00Z") }
    });
    sellerFindUnique.mockResolvedValue(null);
    sellerCreate.mockResolvedValue({ id: "seller-1", status: "PENDING" });
    auditCreate.mockResolvedValue({});
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        seller: { findUnique: sellerFindUnique, create: sellerCreate },
        auditLog: { create: auditCreate }
      })
    );
  });

  it("creates a pending application and an audit event atomically", async () => {
    const result = await submitSellerApplication({
      legalName: "Example Trading BV",
      displayName: "Example Store"
    });

    expect(result).toEqual({
      sellerId: "seller-1",
      status: "PENDING",
      alreadySubmitted: false
    });
    expect(sellerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ownerId: "user-1", status: "PENDING" })
    }));
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("returns the existing pending application without duplicating it", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-existing", status: "PENDING" });

    const result = await submitSellerApplication({
      legalName: "Example Trading BV",
      displayName: "Example Store"
    });

    expect(result.alreadySubmitted).toBe(true);
    expect(sellerCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects an unverified account", async () => {
    requireCurrentSession.mockResolvedValue({
      userId: "user-1",
      user: { emailVerifiedAt: null }
    });

    await expect(submitSellerApplication({
      legalName: "Example Trading BV",
      displayName: "Example Store"
    })).rejects.toThrow(/verified email/i);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid application details", async () => {
    await expect(submitSellerApplication({
      legalName: "x",
      displayName: "Example Store"
    })).rejects.toThrow();
    expect(requireCurrentSession).not.toHaveBeenCalled();
  });
});
