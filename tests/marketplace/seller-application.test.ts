import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { requireCurrentSession, requirePermission, sellerFindUnique, sellerCreate, auditCreate, transaction, roleFindUnique, roleUpsert, sellerUpdateMany, storeFindUnique, storeCreate, marketFindMany } = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(), requirePermission: vi.fn(), sellerFindUnique: vi.fn(),
  sellerCreate: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(),
  roleFindUnique: vi.fn(), roleUpsert: vi.fn(), sellerUpdateMany: vi.fn(),
  storeFindUnique: vi.fn(), storeCreate: vi.fn(), marketFindMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    seller: { findUnique: sellerFindUnique },
    store: { findUnique: storeFindUnique },
    $transaction: transaction
  }
}));

import { createSellerStore, reviewSellerApplication, submitSellerApplication } from "@/server/marketplace/seller-application";

describe("marketplace seller lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({ userId: "user-1", user: { emailVerifiedAt: new Date() } });
    requirePermission.mockResolvedValue({ userId: "admin-1" });
    sellerFindUnique.mockResolvedValue(null);
    sellerCreate.mockResolvedValue({ id: "seller-1", status: "PENDING" });
    auditCreate.mockResolvedValue({});
    roleFindUnique.mockResolvedValue({ id: "role-seller" });
    roleUpsert.mockResolvedValue({});
    sellerUpdateMany.mockResolvedValue({ count: 1 });
    storeFindUnique.mockResolvedValue(null);
    storeCreate.mockResolvedValue({ id: "store-1", name: "Shop", slug: "shop", status: "DRAFT" });
    marketFindMany.mockResolvedValue([{ id: "market-1", defaultCurrencyCode: "EUR", currencies: [{ currencyCode: "EUR" }] }]);
    transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      seller: { findUnique: sellerFindUnique, create: sellerCreate, updateMany: sellerUpdateMany },
      role: { findUnique: roleFindUnique },
      userRoleAssignment: { upsert: roleUpsert },
      auditLog: { create: auditCreate },
      market: { findMany: marketFindMany },
      store: { findUnique: storeFindUnique, create: storeCreate }
    } as unknown as Prisma.TransactionClient));
  });

  it("submits one verified-user application and audits it atomically", async () => {
    const result = await submitSellerApplication({ legalName: "Example Trading BV", displayName: "Example Store" });
    expect(result).toMatchObject({ sellerId: "seller-1", status: "PENDING", alreadySubmitted: false });
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("returns the existing pending application on retry", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-existing", status: "PENDING" });
    const result = await submitSellerApplication({ legalName: "Example Trading BV", displayName: "Example Store" });
    expect(result.alreadySubmitted).toBe(true);
    expect(sellerCreate).not.toHaveBeenCalled();
  });

  it("rejects unverified accounts", async () => {
    requireCurrentSession.mockResolvedValue({ userId: "user-1", user: { emailVerifiedAt: null } });
    await expect(submitSellerApplication({ legalName: "Example Trading BV", displayName: "Example Store" })).rejects.toThrow(/verified email/i);
  });

  it("approves only pending applications and grants SELLER role in the same transaction", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", ownerId: "user-1", status: "PENDING" });
    const result = await reviewSellerApplication({ sellerId: "seller-1", decision: "APPROVE" });
    expect(result.status).toBe("ACTIVE");
    expect(roleUpsert).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId_roleId_scopeType_scopeId: expect.objectContaining({ scopeType: "GLOBAL" }) }) }));
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("requires a reason when rejecting an application", async () => {
    await expect(reviewSellerApplication({ sellerId: "seller-1", decision: "REJECT" })).rejects.toThrow(/reason/i);
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("creates a draft store only for an approved seller and active market", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    const result = await createSellerStore({ name: "Shop", slug: "shop", marketIds: ["market-1"] });
    expect(result).toMatchObject({ status: "DRAFT", alreadyCreated: false });
    expect(requirePermission).toHaveBeenCalledWith(expect.objectContaining({ permissionKey: "store:manage", now: expect.any(Date) }));
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("returns an existing matching store without duplicating audit on retry", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    storeFindUnique.mockResolvedValue({
      id: "store-existing", sellerId: "seller-1", name: "Shop", slug: "shop", status: "DRAFT",
      markets: [{ marketId: "market-1" }]
    });

    const result = await createSellerStore({ name: "Shop", slug: "shop", marketIds: ["market-1", "market-1"] });

    expect(result).toMatchObject({ id: "store-existing", status: "DRAFT", alreadyCreated: true });
    expect(storeCreate).not.toHaveBeenCalled();
    expect(marketFindMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a matching slug when the owner or setup differs", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    storeFindUnique.mockResolvedValue({
      id: "store-existing", sellerId: "seller-other", name: "Shop", slug: "shop", status: "DRAFT",
      markets: [{ marketId: "market-1" }]
    });

    await expect(createSellerStore({ name: "Shop", slug: "shop", marketIds: ["market-1"] }))
      .rejects.toThrow(/URL is already in use/i);
    expect(storeCreate).not.toHaveBeenCalled();
  });

  it("recovers a concurrent identical slug create as an idempotent replay", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    storeFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "store-existing", sellerId: "seller-1", name: "Shop", slug: "shop", status: "DRAFT",
        markets: [{ marketId: "market-1" }]
      });
    storeCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002", clientVersion: "6.19.0", meta: { target: ["slug"] }
    }));

    const result = await createSellerStore({ name: "Shop", slug: "shop", marketIds: ["market-1"] });

    expect(result).toMatchObject({ id: "store-existing", alreadyCreated: true });
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
