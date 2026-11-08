import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  marketFindFirst: vi.fn(),
  shippingRateCreate: vi.fn(),
  shippingRateFindFirst: vi.fn(),
  shippingRateUpdate: vi.fn(),
  auditCreate: vi.fn()
}));
const tx = {
  store: { findUnique: mocks.storeFindUnique },
  market: { findFirst: mocks.marketFindFirst },
  storeShippingRate: { create: mocks.shippingRateCreate, findFirst: mocks.shippingRateFindFirst, update: mocks.shippingRateUpdate },
  auditLog: { create: mocks.auditCreate }
};
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) }
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession, PermissionDeniedError: class PermissionDeniedError extends Error {} }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasScopedPermission: mocks.userHasScopedPermission,
  userHasPermission: mocks.userHasPermission
}));

import { createStoreShippingRate, updateStoreShippingRate } from "@/server/shipping/shipping";

describe("store shipping configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", seller: { ownerId: "owner-1", status: "ACTIVE" }
    });
    mocks.marketFindFirst.mockResolvedValue({ id: "market-1" });
    mocks.shippingRateFindFirst.mockResolvedValue({ id: "rate-1" });
    mocks.shippingRateUpdate.mockImplementation(async ({ data }) => ({ id: "rate-1", storeId: "store-1", ...data, amountMinor: BigInt(data.amountMinor), isActive: true, priority: data.priority ?? 0 }));
    mocks.shippingRateCreate.mockImplementation(async ({ data }) => ({
      id: "rate-1", ...data, amountMinor: BigInt(data.amountMinor), isActive: true, priority: 0
    }));
    mocks.auditCreate.mockResolvedValue({});
  });

  it("creates a market/currency-scoped rate and records an audit event", async () => {
    const result = await createStoreShippingRate({
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Standard", amountMinor: "499", minDeliveryDays: 2, maxDeliveryDays: 5
    });
    expect(mocks.marketFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "market-1", status: "ACTIVE",
        currencies: expect.objectContaining({ some: expect.objectContaining({ currencyCode: "EUR", isEnabled: true }) })
      })
    }));
    expect(result.amountMinor).toBe("499");
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("updates only a rate owned by the authorized store and audits the change", async () => {
    const result = await updateStoreShippingRate("rate-1", {
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Express", description: "Tracked delivery", amountMinor: "799",
      minDeliveryDays: 1, maxDeliveryDays: 2, priority: 5
    });
    expect(mocks.shippingRateFindFirst).toHaveBeenCalledWith({
      where: { id: "rate-1", storeId: "store-1" }, select: { id: true }
    });
    expect(mocks.shippingRateUpdate).toHaveBeenCalledOnce();
    expect(result.amountMinor).toBe("799");
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects edits from a user without store-scoped shipping permission", async () => {
    mocks.requireCurrentSession.mockResolvedValue({ userId: "intruder-1" });
    await expect(updateStoreShippingRate("rate-1", {
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Express", amountMinor: "799"
    })).rejects.toThrow(/shipping configuration access/i);
    expect(mocks.shippingRateUpdate).not.toHaveBeenCalled();
  });

  it("does not update a shipping rate belonging to another store", async () => {
    mocks.shippingRateFindFirst.mockResolvedValue(null);
    await expect(updateStoreShippingRate("foreign-rate", {
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Express", amountMinor: "799"
    })).rejects.toThrow(/not found/i);
    expect(mocks.shippingRateUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid delivery windows before writing", async () => {
    await expect(createStoreShippingRate({
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Fast", amountMinor: "499", minDeliveryDays: 6, maxDeliveryDays: 2
    })).rejects.toThrow();
    expect(mocks.shippingRateCreate).not.toHaveBeenCalled();
  });

  it("rejects a market/currency the store is not configured to serve", async () => {
    mocks.marketFindFirst.mockResolvedValue(null);
    await expect(createStoreShippingRate({
      storeId: "store-1", marketId: "market-1", currencyCode: "EUR",
      name: "Standard", amountMinor: "499"
    })).rejects.toThrow("active market and currency");
    expect(mocks.shippingRateCreate).not.toHaveBeenCalled();
  });
});
