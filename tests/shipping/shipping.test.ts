import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  userHasScopedPermission: vi.fn(),
  userHasPermission: vi.fn(),
  storeFindUnique: vi.fn(),
  marketFindFirst: vi.fn(),
  shippingRateCreate: vi.fn(),
  auditCreate: vi.fn()
}));
const tx = {
  store: { findUnique: mocks.storeFindUnique },
  market: { findFirst: mocks.marketFindFirst },
  storeShippingRate: { create: mocks.shippingRateCreate },
  auditLog: { create: mocks.auditCreate }
};
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) }
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasScopedPermission: mocks.userHasScopedPermission,
  userHasPermission: mocks.userHasPermission
}));

import { createStoreShippingRate } from "@/server/shipping/shipping";

describe("store shipping configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.storeFindUnique.mockResolvedValue({
      id: "store-1", seller: { ownerId: "owner-1", status: "ACTIVE" }
    });
    mocks.marketFindFirst.mockResolvedValue({ id: "market-1" });
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
