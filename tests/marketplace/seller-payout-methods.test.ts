import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  requirePlatformManagement: vi.fn(),
  sellerFindUnique: vi.fn(),
  countryFindUnique: vi.fn(),
  currencyFindUnique: vi.fn(),
  payoutFindUnique: vi.fn(),
  payoutFindUniqueOrThrow: vi.fn(),
  payoutCount: vi.fn(),
  payoutUpdateMany: vi.fn(),
  payoutCreate: vi.fn(),
  payoutUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  encrypt: vi.fn(),
  fingerprint: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePlatformManagement: mocks.requirePlatformManagement }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    seller: { findUnique: mocks.sellerFindUnique },
    country: { findUnique: mocks.countryFindUnique },
    currency: { findUnique: mocks.currencyFindUnique },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/server/finance/seller-payout-encryption", () => ({
  encryptSellerPayoutDetails: mocks.encrypt,
  fingerprintSellerPayoutAccount: mocks.fingerprint
}));

import { PermissionDeniedError } from "@/server/identity/access-errors";
import { createSellerPayoutMethod, reviewSellerPayoutMethod, SellerPayoutSelfVerificationError, SellerPayoutVerificationConflictError, SellerPayoutValidationError } from "@/server/marketplace/seller-payout-methods";

const createdMethod = {
  id: "payout-1", type: "IBAN", accountHolderName: "Example Owner", bankName: "Example Bank",
  countryCode: "DE", currencyCode: "EUR", accountLast4: "3000",
  status: "PENDING_VERIFICATION", isDefault: true, verifiedAt: null, submissionVersion: 1,
  createdAt: new Date("2026-11-10T00:00:00.000Z"), updatedAt: new Date("2026-11-10T00:00:00.000Z")
};

describe("seller payout destination security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "admin-1" });
    mocks.sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    mocks.countryFindUnique.mockResolvedValue({ isActive: true });
    mocks.currencyFindUnique.mockResolvedValue({ code: "EUR", isActive: true });
    mocks.payoutFindUnique.mockResolvedValue(null);
    mocks.payoutCount.mockResolvedValue(0);
    mocks.payoutUpdateMany.mockResolvedValue({ count: 0 });
    mocks.payoutCreate.mockResolvedValue(createdMethod);
    mocks.payoutUpdate.mockResolvedValue(createdMethod);
    mocks.payoutFindUniqueOrThrow.mockResolvedValue({ ...createdMethod, status: "VERIFIED", verifiedAt: new Date() });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.encrypt.mockReturnValue({ encryptedDetails: "v1.nonce.tag.ciphertext", keyVersion: 1 });
    mocks.fingerprint.mockReturnValue("f".repeat(64));
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      sellerPayoutMethod: {
        findUnique: mocks.payoutFindUnique,
        count: mocks.payoutCount,
        updateMany: mocks.payoutUpdateMany,
        create: mocks.payoutCreate,
        update: mocks.payoutUpdate
      },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("stores only encrypted account details and returns a masked pending-verification record", async () => {
    const result = await createSellerPayoutMethod({
      type: "IBAN",
      accountHolderName: "Example Owner",
      bankName: "Example Bank",
      countryCode: "DE",
      currencyCode: "EUR",
      accountIdentifier: "DE89 3704 0044 0532 0130 00",
      routingCode: "ABCDEF12",
      isDefault: true
    });

    expect(result).toEqual(createdMethod);
    expect(mocks.sellerFindUnique).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" }, select: { id: true, status: true }
    });
    expect(mocks.encrypt).toHaveBeenCalledWith({
      accountIdentifier: "DE89370400440532013000",
      accountHolderName: "Example Owner",
      routingCode: "ABCDEF12"
    });
    expect(mocks.payoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        encryptedDetails: "v1.nonce.tag.ciphertext",
        encryptionKeyVersion: 1,
        accountLast4: "3000",
        fingerprint: "f".repeat(64),
        status: "PENDING_VERIFICATION",
        verifiedAt: null
      }),
      select: expect.objectContaining({ accountLast4: true })
    }));
    const auditData = mocks.auditCreate.mock.calls[0][0].data;
    expect(JSON.stringify(auditData)).not.toContain("DE89370400440532013000");
    expect(JSON.stringify(auditData)).not.toContain("ABCDEF12");
    expect(result).not.toHaveProperty("encryptedDetails");
    expect(result).not.toHaveProperty("accountIdentifier");
  });

  it("rejects an IBAN whose country prefix does not match the selected bank country", async () => {
    await expect(createSellerPayoutMethod({
      type: "IBAN",
      accountHolderName: "Example Owner",
      bankName: "Example Bank",
      countryCode: "FR",
      currencyCode: "EUR",
      accountIdentifier: "DE89370400440532013000"
    })).rejects.toBeInstanceOf(SellerPayoutValidationError);

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a user without an active seller account before reading or writing payout methods", async () => {
    mocks.sellerFindUnique.mockResolvedValue(null);

    await expect(createSellerPayoutMethod({
      type: "IBAN",
      accountHolderName: "Example Owner",
      bankName: "Example Bank",
      countryCode: "DE",
      currencyCode: "EUR",
      accountIdentifier: "DE89370400440532013000"
    })).rejects.toBeInstanceOf(PermissionDeniedError);

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.payoutCreate).not.toHaveBeenCalled();
  });
});


describe("admin seller bank destination review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "admin-1" });
    mocks.payoutFindUnique.mockResolvedValue({
      id: "payout-1", sellerId: "seller-1", accountLast4: "3000", currencyCode: "EUR",
      status: "PENDING_VERIFICATION", isDefault: true, submissionVersion: 1, seller: { ownerId: "owner-1" }
    });
    mocks.payoutUpdateMany.mockResolvedValue({ count: 1 });
    mocks.payoutFindUniqueOrThrow.mockResolvedValue({ ...createdMethod, status: "VERIFIED", verifiedAt: new Date() });
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      sellerPayoutMethod: {
        findUnique: mocks.payoutFindUnique,
        updateMany: mocks.payoutUpdateMany,
        findUniqueOrThrow: mocks.payoutFindUniqueOrThrow
      },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  const reviewInput = {
    decision: "VERIFIED",
    evidenceReference: "BANK-CALL-CASE-2026-001",
    reason: "Account ownership confirmed through the bank's official verification channel.",
    expectedSubmissionVersion: 1
  };

  it("records an audited verification decision without exposing account details", async () => {
    const result = await reviewSellerPayoutMethod("payout-1", reviewInput);
    expect(result.status).toBe("VERIFIED");
    expect(mocks.requirePlatformManagement).toHaveBeenCalledOnce();
    expect(mocks.payoutUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payout-1", status: "PENDING_VERIFICATION", submissionVersion: 1 },
      data: expect.objectContaining({ status: "VERIFIED", verifiedAt: expect.any(Date) })
    }));
    const audit = mocks.auditCreate.mock.calls[0][0].data;
    expect(audit.action).toBe("SELLER_PAYOUT_METHOD_VERIFIED");
    expect(audit.metadata.evidenceReference).toBe(reviewInput.evidenceReference);
    expect(JSON.stringify(audit)).not.toContain("accountIdentifier");
  });

  it("prevents a seller from reviewing their own bank destination", async () => {
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "owner-1" });
    await expect(reviewSellerPayoutMethod("payout-1", reviewInput)).rejects.toBeInstanceOf(SellerPayoutSelfVerificationError);
    expect(mocks.payoutUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a stale review after a disabled destination is re-registered", async () => {
    mocks.payoutFindUnique.mockResolvedValue({
      id: "payout-1", sellerId: "seller-1", accountLast4: "3000", currencyCode: "EUR",
      status: "PENDING_VERIFICATION", isDefault: true, submissionVersion: 2,
      seller: { ownerId: "owner-1" }
    });
    await expect(reviewSellerPayoutMethod("payout-1", reviewInput)).rejects.toBeInstanceOf(SellerPayoutVerificationConflictError);
    expect(mocks.payoutUpdateMany).not.toHaveBeenCalled();
  });

  it("prevents a second review of an already reviewed destination", async () => {
    mocks.payoutFindUnique.mockResolvedValue({
      id: "payout-1", sellerId: "seller-1", accountLast4: "3000", currencyCode: "EUR",
      status: "VERIFIED", isDefault: true, submissionVersion: 1, seller: { ownerId: "owner-1" }
    });
    await expect(reviewSellerPayoutMethod("payout-1", reviewInput)).rejects.toBeInstanceOf(SellerPayoutVerificationConflictError);
    expect(mocks.payoutUpdate).not.toHaveBeenCalled();
  });
});
