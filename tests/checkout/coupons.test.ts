import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  currencyFindFirst: vi.fn(),
  couponCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

const tx = {
  currency: { findFirst: mocks.currencyFindFirst },
  coupon: { create: mocks.couponCreate },
  auditLog: { create: mocks.auditCreate }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));

import { createCoupon } from "@/server/checkout/coupons";

describe("checkout coupon administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.currencyFindFirst.mockResolvedValue({ code: "EUR" });
    mocks.couponCreate.mockImplementation(async ({ data }) => ({
      id: "coupon-1", ...data, currency: data.currencyCode ? { code: data.currencyCode } : null,
      _count: { redemptions: 0 }, createdAt: new Date(), updatedAt: new Date()
    }));
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  it("creates an audited percentage coupon with normalized code", async () => {
    const coupon = await createCoupon({
      code: " save10 ", discountType: "PERCENTAGE", value: "1000", maxRedemptions: 100
    });

    expect(coupon).toMatchObject({
      code: "SAVE10", discountType: "PERCENTAGE", value: "1000", maxRedemptions: 100
    });
    expect(mocks.couponCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ value: BigInt(1000) })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("requires an active currency for a fixed-amount coupon", async () => {
    mocks.currencyFindFirst.mockResolvedValue(null);

    await expect(createCoupon({
      code: "TENEURO", discountType: "FIXED_AMOUNT", value: "1000", currencyCode: "EUR"
    })).rejects.toThrow("active currency");
    expect(mocks.couponCreate).not.toHaveBeenCalled();
  });

  it("rejects percentage coupons greater than one hundred percent", async () => {
    await expect(createCoupon({
      code: "TOOMUCH", discountType: "PERCENTAGE", value: "10001"
    })).rejects.toThrow();
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });
});
