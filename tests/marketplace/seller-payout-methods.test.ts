import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  sellerFindUnique: vi.fn(),
  countryFindUnique: vi.fn(),
  currencyFindUnique: vi.fn(),
  payoutFindUnique: vi.fn(),
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
import { createSellerPayoutMethod, SellerPayoutValidationError } from "@/server/marketplace/seller-payout-methods";

const createdMethod = {
  id: "payout-1", type: "IBAN", accountHolderName: "Example Owner", bankName: "Example Bank",
  countryCode: "DE", currencyCode: "EUR", accountLast4: "3000",
  status: "PENDING_VERIFICATION", isDefault: true, verifiedAt: null,
  createdAt: new Date("2026-11-10T00:00:00.000Z"), updatedAt: new Date("2026-11-10T00:00:00.000Z")
};

describe("seller payout destination security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.sellerFindUnique.mockResolvedValue({ id: "seller-1", status: "ACTIVE" });
    mocks.countryFindUnique.mockResolvedValue({ isActive: true });
    mocks.currencyFindUnique.mockResolvedValue({ code: "EUR", isActive: true });
    mocks.payoutFindUnique.mockResolvedValue(null);
    mocks.payoutCount.mockResolvedValue(0);
    mocks.payoutUpdateMany.mockResolvedValue({ count: 0 });
    mocks.payoutCreate.mockResolvedValue(createdMethod);
    mocks.payoutUpdate.mockResolvedValue(createdMethod);
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
