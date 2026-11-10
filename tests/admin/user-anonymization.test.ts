import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformManagement: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
  roleFindMany: vi.fn(),
  roleDeleteMany: vi.fn(),
  sellerUpdateMany: vi.fn(),
  productUpdateMany: vi.fn(),
  storeUpdateMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
  productReviewUpdateMany: vi.fn(),
  storeReviewUpdateMany: vi.fn(),
  productQuestionUpdateMany: vi.fn(),
  productAnswerUpdateMany: vi.fn(),
  staffUpdateMany: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  verificationDeleteMany: vi.fn(),
  oauthDeleteMany: vi.fn(),
  twoFactorDeleteMany: vi.fn(),
  notificationDeleteMany: vi.fn(),
  notificationPreferenceDeleteMany: vi.fn(),
  notificationDeliveryDeleteMany: vi.fn(),
  favoriteDeleteMany: vi.fn(),
  addressDeleteMany: vi.fn(),
  cartItemDeleteMany: vi.fn(),
  cartUpdateMany: vi.fn(),
  checkoutQuoteUpdateMany: vi.fn(),
  checkoutQuoteAddressUpdateMany: vi.fn(),
  couponRedemptionUpdateMany: vi.fn(),
  loginAttemptUpdateMany: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: vi.fn(),
  requirePlatformManagement: mocks.requirePlatformManagement
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

import { anonymizeAdminUser } from "@/server/admin/users";

describe("Super Admin account anonymization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "root-1" });
    mocks.userFindUnique.mockResolvedValue({
      id: "buyer-1",
      email: "buyer@example.test",
      status: "ACTIVE",
      anonymizedAt: null
    });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sellerUpdateMany.mockResolvedValue({ count: 1 });
    mocks.productUpdateMany.mockResolvedValue({ count: 2 });
    mocks.storeUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 3 });
    mocks.roleFindMany.mockResolvedValue([]);
    mocks.roleDeleteMany.mockResolvedValue({ count: 1 });
    mocks.productReviewUpdateMany.mockResolvedValue({ count: 0 });
    mocks.storeReviewUpdateMany.mockResolvedValue({ count: 0 });
    mocks.productQuestionUpdateMany.mockResolvedValue({ count: 0 });
    mocks.productAnswerUpdateMany.mockResolvedValue({ count: 0 });
    mocks.staffUpdateMany.mockResolvedValue({ count: 0 });
    mocks.passwordResetDeleteMany.mockResolvedValue({ count: 0 });
    mocks.verificationDeleteMany.mockResolvedValue({ count: 0 });
    mocks.oauthDeleteMany.mockResolvedValue({ count: 0 });
    mocks.twoFactorDeleteMany.mockResolvedValue({ count: 0 });
    mocks.notificationDeleteMany.mockResolvedValue({ count: 0 });
    mocks.notificationPreferenceDeleteMany.mockResolvedValue({ count: 0 });
    mocks.notificationDeliveryDeleteMany.mockResolvedValue({ count: 0 });
    mocks.favoriteDeleteMany.mockResolvedValue({ count: 0 });
    mocks.addressDeleteMany.mockResolvedValue({ count: 0 });
    mocks.cartItemDeleteMany.mockResolvedValue({ count: 0 });
    mocks.cartUpdateMany.mockResolvedValue({ count: 0 });
    mocks.checkoutQuoteUpdateMany.mockResolvedValue({ count: 0 });
    mocks.checkoutQuoteAddressUpdateMany.mockResolvedValue({ count: 0 });
    mocks.couponRedemptionUpdateMany.mockResolvedValue({ count: 0 });
    mocks.loginAttemptUpdateMany.mockResolvedValue({ count: 0 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      user: { findUnique: mocks.userFindUnique, updateMany: mocks.userUpdateMany },
      userRoleAssignment: { findMany: mocks.roleFindMany, deleteMany: mocks.roleDeleteMany },
      seller: { updateMany: mocks.sellerUpdateMany },
      product: { updateMany: mocks.productUpdateMany },
      store: { updateMany: mocks.storeUpdateMany },
      userSession: { updateMany: mocks.sessionUpdateMany },
      productReview: { updateMany: mocks.productReviewUpdateMany },
      storeReview: { updateMany: mocks.storeReviewUpdateMany },
      productQuestion: { updateMany: mocks.productQuestionUpdateMany },
      productAnswer: { updateMany: mocks.productAnswerUpdateMany },
      sellerStaff: { updateMany: mocks.staffUpdateMany },
      passwordResetToken: { deleteMany: mocks.passwordResetDeleteMany },
      verificationToken: { deleteMany: mocks.verificationDeleteMany },
      oAuthAccount: { deleteMany: mocks.oauthDeleteMany },
      userTwoFactor: { deleteMany: mocks.twoFactorDeleteMany },
      notification: { deleteMany: mocks.notificationDeleteMany },
      notificationPreference: { deleteMany: mocks.notificationPreferenceDeleteMany },
      notificationDelivery: { deleteMany: mocks.notificationDeliveryDeleteMany },
      favorite: { deleteMany: mocks.favoriteDeleteMany },
      userAddress: { deleteMany: mocks.addressDeleteMany },
      cartItem: { deleteMany: mocks.cartItemDeleteMany },
      cart: { updateMany: mocks.cartUpdateMany },
      checkoutQuote: { updateMany: mocks.checkoutQuoteUpdateMany },
      checkoutQuoteAddress: { updateMany: mocks.checkoutQuoteAddressUpdateMany },
      couponRedemption: { updateMany: mocks.couponRedemptionUpdateMany },
      loginAttempt: { updateMany: mocks.loginAttemptUpdateMany },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("requires the exact email and a reason before changing an account", async () => {
    await expect(anonymizeAdminUser("buyer-1", {
      confirmationEmail: "other@example.test",
      reason: "Approved removal"
    })).rejects.toThrow("confirmation email does not match");
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("disables and anonymizes identity, hides seller content, and retains financial records", async () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    const result = await anonymizeAdminUser("buyer-1", {
      confirmationEmail: "buyer@example.test",
      reason: "Account closure requested"
    }, now);

    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "buyer-1", anonymizedAt: null },
      data: expect.objectContaining({
        email: "deleted-buyer-1@redacted.invalid",
        emailNormalized: "deleted-buyer-1@redacted.invalid",
        status: "DISABLED",
        passwordHash: null,
        anonymizedAt: now
      })
    });
    expect(mocks.storeUpdateMany).toHaveBeenCalledWith({
      where: { seller: { ownerId: "buyer-1" } },
      data: { status: "CLOSED" }
    });
    expect(mocks.productUpdateMany).toHaveBeenCalledWith({
      where: { store: { seller: { ownerId: "buyer-1" } } },
      data: { status: "ARCHIVED" }
    });
    expect(mocks.sessionUpdateMany).toHaveBeenCalled();
    expect(mocks.roleDeleteMany).toHaveBeenCalledWith({ where: { userId: "buyer-1" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "identity.user.anonymized",
        metadata: expect.objectContaining({
          reason: "Account closure requested",
          preservedFinancialAndAuditRecords: true
        })
      })
    }));
    expect(result).toMatchObject({ storesClosed: 1, productsArchived: 2 });
  });

  it("refuses self-anonymization", async () => {
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "buyer-1" });
    await expect(anonymizeAdminUser("buyer-1", {
      confirmationEmail: "buyer@example.test",
      reason: "Account closure requested"
    })).rejects.toThrow("cannot anonymize their own account");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
