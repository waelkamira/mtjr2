import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { requireCurrentSession, requirePermission, sellerFindUnique, sellerCreate, auditCreate, transaction, roleFindUnique, roleUpsert, sellerUpdateMany, storeFindUnique, storeFindFirst, storeCreate, marketFindMany, queryRaw } = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(), requirePermission: vi.fn(), sellerFindUnique: vi.fn(),
  sellerCreate: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(),
  roleFindUnique: vi.fn(), roleUpsert: vi.fn(), sellerUpdateMany: vi.fn(),
  storeFindUnique: vi.fn(), storeFindFirst: vi.fn(), storeCreate: vi.fn(), marketFindMany: vi.fn(), queryRaw: vi.fn()
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
    requireCurrentSession.mockResolvedValue({ userId: "user-1", user: { emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z") } });
    requirePermission.mockResolvedValue({ userId: "admin-1" });
    sellerFindUnique.mockResolvedValue(null);
    sellerCreate.mockResolvedValue({ id: "seller-1", status: "PENDING" });
    auditCreate.mockResolvedValue({});
    roleFindUnique.mockResolvedValue({ id: "role-seller" });
    roleUpsert.mockResolvedValue({});
    sellerUpdateMany.mockResolvedValue({ count: 1 });
    storeFindUnique.mockResolvedValue(null);
    storeFindFirst.mockResolvedValue(null);
    storeCreate.mockResolvedValue({ id: "store-1", storeNumber: BigInt("201"), name: "Shop", slug: "shop", status: "DRAFT" });
    marketFindMany.mockResolvedValue([{ id: "market-1", defaultCurrencyCode: "EUR", currencies: [{ currencyCode: "EUR" }] }]);
    transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) => callback({
      seller: { findUnique: sellerFindUnique, create: sellerCreate, updateMany: sellerUpdateMany },
      role: { findUnique: roleFindUnique },
      userRoleAssignment: { upsert: roleUpsert },
      auditLog: { create: auditCreate },
      market: { findMany: marketFindMany },
      $queryRaw: queryRaw,
      store: { findUnique: storeFindUnique, findFirst: storeFindFirst, create: storeCreate }
    } as unknown as Prisma.TransactionClient));
  });

  it("submits one authenticated-user application and audits it atomically", async () => {
    const result = await submitSellerApplication({
      legalName: "Example Trading BV", displayName: "Example Store",
      contactName: "Alex Example", contactEmail: "SELLER@example.com", phoneNumber: "+33123456789",
      residence: "Paris, France", businessType: "STORE", sellingCategories: "Home goods",
      intendedProducts: "Household products sourced from local suppliers, with weekly restock.",
      facebookUrl: "https://facebook.com/example", latitude: 48.8566, longitude: 2.3522
    });
    expect(result).toMatchObject({ sellerId: "seller-1", status: "PENDING", alreadySubmitted: false });
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(sellerCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      contactName: "Alex Example", contactEmail: "seller@example.com", phoneNumber: "+33123456789",
      businessType: "STORE", latitude: 48.8566, longitude: 2.3522
    }) }));
  });

  it("requires a verified account email before seller application submission", async () => {
    requireCurrentSession.mockResolvedValue({ userId: "user-1", user: { emailVerifiedAt: null } });
    await expect(submitSellerApplication({
      legalName: "Example Trading BV", displayName: "Example Store",
      contactName: "Alex Example", contactEmail: "seller@example.com", phoneNumber: "+33123456789",
      residence: "Paris, France", businessType: "STORE", sellingCategories: "Home goods",
      intendedProducts: "Household products sourced from local suppliers, with weekly restock.",
      latitude: 48.8566, longitude: 2.3522
    })).rejects.toThrow(/verify your email/i);
    expect(sellerCreate).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS seller social links and out-of-range map coordinates", async () => {
    const validInput = {
      legalName: "Example Trading BV", displayName: "Example Store",
      contactName: "Alex Example", contactEmail: "seller@example.com", phoneNumber: "+33123456789",
      residence: "Paris, France", businessType: "STORE" as const, sellingCategories: "Home goods",
      intendedProducts: "Household products sourced from local suppliers, with weekly restock.",
      latitude: 48.8566, longitude: 2.3522
    };
    await expect(submitSellerApplication({ ...validInput, facebookUrl: "http://example.com" })).rejects.toThrow();
    await expect(submitSellerApplication({ ...validInput, latitude: 120 })).rejects.toThrow();
    expect(requireCurrentSession).not.toHaveBeenCalled();
  });

  it("allows a rejected seller to correct details and resubmit the same application", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-rejected", status: "REJECTED" });
    const result = await submitSellerApplication({
      legalName: "Updated Trading BV", displayName: "Updated Store",
      contactName: "Alex Example", contactEmail: "seller@example.com", phoneNumber: "+33123456789",
      residence: "Paris, France", businessType: "STORE", sellingCategories: "Home goods",
      intendedProducts: "Updated household products and a clearer supplier and fulfilment plan.",
      latitude: 48.8566, longitude: 2.3522
    });
    expect(result).toMatchObject({ sellerId: "seller-rejected", status: "PENDING", resubmitted: true });
    expect(sellerUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "seller-rejected", ownerId: "user-1", status: "REJECTED" },
      data: expect.objectContaining({ legalName: "Updated Trading BV", status: "PENDING" })
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "seller.application.resubmitted" })
    }));
  });

  it("returns the existing pending application on retry", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-existing", status: "PENDING" });
    const result = await submitSellerApplication({
      legalName: "Example Trading BV", displayName: "Example Store",
      contactName: "Alex Example", contactEmail: "SELLER@example.com", phoneNumber: "+33123456789",
      residence: "Paris, France", businessType: "STORE", sellingCategories: "Home goods",
      intendedProducts: "Household products sourced from local suppliers, with weekly restock.",
      facebookUrl: "https://facebook.com/example", latitude: 48.8566, longitude: 2.3522
    });
    expect(result.alreadySubmitted).toBe(true);
    expect(sellerCreate).not.toHaveBeenCalled();
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
    expect(result).toMatchObject({ status: "DRAFT", storeNumber: "201", alreadyCreated: false });
    expect(requirePermission).toHaveBeenCalledWith(expect.objectContaining({ permissionKey: "store:manage", now: expect.any(Date) }));
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("returns an existing matching store without duplicating audit on retry", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    const existingStore = {
      id: "store-existing", sellerId: "seller-1", storeNumber: BigInt("202"), name: "Shop", slug: "shop", status: "DRAFT",
      markets: [{ marketId: "market-1" }]
    };
    storeFindUnique.mockResolvedValue(existingStore);
    storeFindFirst.mockResolvedValue(existingStore);

    const result = await createSellerStore({ name: "Shop", slug: "shop", marketIds: ["market-1", "market-1"] });

    expect(result).toMatchObject({ id: "store-existing", storeNumber: "202", status: "DRAFT", alreadyCreated: true });
    expect(storeCreate).not.toHaveBeenCalled();
    expect(marketFindMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("blocks a seller from creating a second store under a different slug", async () => {
    sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    storeFindFirst.mockResolvedValue({
      id: "store-existing", sellerId: "seller-1", storeNumber: BigInt("202"),
      name: "First shop", slug: "first-shop", status: "ACTIVE",
      markets: [{ marketId: "market-1" }]
    });

    await expect(createSellerStore({
      name: "Second shop", slug: "second-shop", marketIds: ["market-1"]
    })).rejects.toThrow(/own only one store/i);
    expect(storeCreate).not.toHaveBeenCalled();
    expect(marketFindMany).not.toHaveBeenCalled();
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
        id: "store-existing", sellerId: "seller-1", storeNumber: BigInt("202"), name: "Shop", slug: "shop", status: "DRAFT",
        markets: [{ marketId: "market-1" }]
      });
    storeCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002", clientVersion: "6.19.0", meta: { target: ["slug"] }
    }));

    const result = await createSellerStore({ name: "Shop", slug: "shop", marketIds: ["market-1"] });

    expect(result).toMatchObject({ id: "store-existing", storeNumber: "202", alreadyCreated: true });
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
