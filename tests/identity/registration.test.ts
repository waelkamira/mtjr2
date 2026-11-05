import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentType, Prisma, UserStatus } from "@prisma/client";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    user: { create: vi.fn() },
    seller: { create: vi.fn() },
    userConsent: { createMany: vi.fn() },
    auditLog: { create: vi.fn() }
  };
  return {
    txMock: tx,
    prismaMock: {
      user: { findFirst: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    }
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  IdentityConflictError,
  registerUser
} from "../../src/server/identity/registration";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
    prismaMock.user.findFirst.mockResolvedValue(null);
    txMock.user.create.mockResolvedValue({ id: "user-1" });
    txMock.seller.create.mockResolvedValue({ id: "seller-1" });
    txMock.userConsent.createMany.mockResolvedValue({ count: 2 });
  });

  it("creates an active user with a hashed password and required consents", async () => {
    await expect(registerUser({
      email: "  Buyer@Example.COM ",
      password: "correct horse battery staple 2026",
      displayName: " Buyer ",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    }, now)).resolves.toEqual({ userId: "user-1" });

    expect(txMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "buyer@example.com",
        emailNormalized: "buyer@example.com",
        status: UserStatus.ACTIVE,
        displayName: "Buyer"
      })
    }));
    const createUserCall = txMock.user.create.mock.calls[0][0];
    expect(createUserCall.data.passwordHash).not.toContain("correct horse");
    expect(createUserCall.data.emailVerifiedAt).toBeUndefined();
    expect(txMock.userConsent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ type: ConsentType.TERMS_OF_SERVICE, granted: true }),
        expect.objectContaining({ type: ConsentType.PRIVACY_POLICY, granted: true })
      ])
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "identity.registration.created",
        resourceId: "user-1"
      })
    });
  });

  it("creates a pending seller application when the user selects seller", async () => {
    await registerUser({
      email: "seller@example.com",
      password: "correct horse battery staple 2026",
      accountType: "SELLER",
      sellerLegalName: "Example Applicant",
      sellerDisplayName: "Example Store",
      acceptedTerms: true,
      acceptedPrivacy: true
    }, now);

    expect(txMock.seller.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        legalName: "Example Applicant",
        displayName: "Example Store",
        status: "PENDING"
      }
    });
  });

  it("returns an identity conflict before hashing or inserting an existing email", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "existing-user" });

    await expect(registerUser({
      email: "  Buyer@Example.COM ",
      password: "correct horse battery staple 2026",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    }, now)).rejects.toBeInstanceOf(IdentityConflictError);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { email: "buyer@example.com" },
          { emailNormalized: "buyer@example.com" }
        ]
      },
      select: { id: true }
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a concurrent duplicate when the normalized-email unique index wins the race", async () => {
    txMock.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.0",
      meta: { target: ["emailNormalized"] }
    }));

    await expect(registerUser({
      email: "Buyer@Example.COM",
      password: "correct horse battery staple 2026",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    }, now)).rejects.toBeInstanceOf(IdentityConflictError);
  });

  it("requires seller details and explicit policy consent", async () => {
    await expect(registerUser({
      email: "seller@example.com",
      password: "correct horse battery staple 2026",
      accountType: "SELLER",
      acceptedTerms: true,
      acceptedPrivacy: true
    } as never, now)).rejects.toThrow();
    await expect(registerUser({
      email: "buyer@example.com",
      password: "correct horse battery staple 2026",
      accountType: "CUSTOMER",
      acceptedTerms: false,
      acceptedPrivacy: true
    } as never, now)).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
