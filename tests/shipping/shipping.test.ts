import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  marketFindFirst: vi.fn(),
  rateCreate: vi.fn(),
  rateFindFirst: vi.fn(),
  rateUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasScopedPermission: mocks.userHasScopedPermission,
  userHasPermission: mocks.userHasPermission
}));
vi.mock("@/server/checkout/quotes", () => ({ getCheckoutQuote: vi.fn() }));

import { createStoreShippingRate, updateStoreShippingRate } from "@/server/shipping/shipping";

describe("seller shipping rate management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "seller-1" });
    mocks.userHasPermission.mockResolvedValue(false);
    mocks.userHasScopedPermission.mockResolvedValue(false);
    mocks.storeFindUnique.mockResolvedValue({ id: "store-1", seller: { ownerId: "seller-1", status: "ACTIVE" } });
    mocks.marketFindFirst.mockResolvedValue({ id: "market-1" });
    mocks.rateCreate.mockResolvedValue({
      id: "rate-1", storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Standard", description: null, amountMinor: BigInt("1299"),
      destinationRegion: null, minDeliveryDays: 2, maxDeliveryDays: 5, isActive: true, priority: 0
    });
    mocks.rateFindFirst.mockResolvedValue({ id: "rate-1" });
    mocks.rateUpdate.mockResolvedValue({
      id: "rate-1", storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Express", description: "Fast delivery", amountMinor: BigInt("2500"),
      destinationRegion: "Damascus", minDeliveryDays: 1, maxDeliveryDays: 2, isActive: true, priority: 0
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      store: { findUnique: mocks.storeFindUnique },
      market: { findFirst: mocks.marketFindFirst },
      storeShippingRate: { create: mocks.rateCreate, findFirst: mocks.rateFindFirst, update: mocks.rateUpdate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("creates and audits a seller-owned shipping service with minor-unit money", async () => {
    const result = await createStoreShippingRate({
      storeId: "store-1", marketId: "market-1", currencyCode: "eur",
      name: "Standard", amountMinor: "1299", minDeliveryDays: 2, maxDeliveryDays: 5
    });

    expect(result.amountMinor).toBe("1299");
    expect(mocks.rateCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ storeId: "store-1", marketId: "market-1", currencyCode: "EUR", amountMinor: BigInt("1299") })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("updates only a shipping service belonging to the seller's store", async () => {
    const result = await updateStoreShippingRate("rate-1", {
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Express", description: "Fast delivery", amountMinor: "2500",
      destinationRegion: "Damascus", minDeliveryDays: 1, maxDeliveryDays: 2
    });

    expect(result.amountMinor).toBe("2500");
    expect(mocks.rateFindFirst).toHaveBeenCalledWith({ where: { id: "rate-1", storeId: "store-1" }, select: { id: true } });
    expect(mocks.rateUpdate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("denies a different seller without an exact store-scoped grant", async () => {
    mocks.storeFindUnique.mockResolvedValue({ id: "store-1", seller: { ownerId: "another-seller", status: "ACTIVE" } });

    await expect(createStoreShippingRate({
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR", name: "Standard", amountMinor: "1299"
    })).rejects.toThrow(/shipping configuration access/i);
    expect(mocks.marketFindFirst).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("rejects impossible delivery windows before writing", async () => {
    await expect(createStoreShippingRate({
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Standard", amountMinor: "1299", minDeliveryDays: 5, maxDeliveryDays: 2
    })).rejects.toThrow(/maximum delivery days/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
