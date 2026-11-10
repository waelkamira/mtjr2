import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentType, Prisma, UserStatus } from "@prisma/client";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    user: { create: vi.fn(), updateMany: vi.fn() },
    seller: { create: vi.fn() },
    role: { findUnique: vi.fn() },
    userRoleAssignment: { create: vi.fn() },
    userConsent: { createMany: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
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
  registerUser,
  verifyUserEmail
} from "../../src/server/identity/registration";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.role.findUnique.mockResolvedValue({ id: "customer-role-1" });
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
    prismaMock.user.findFirst.mockResolvedValue(null);
    txMock.user.create.mockResolvedValue({ id: "user-1" });
    txMock.user.updateMany.mockResolvedValue({ count: 1 });
    txMock.seller.create.mockResolvedValue({ id: "seller-1" });
    txMock.userConsent.createMany.mockResolvedValue({ count: 2 });
    txMock.verificationToken.create.mockResolvedValue({ id: "verification-1" });
    txMock.verificationToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it("creates an active customer with a hashed password and explicit consent", async () => {
    const result = await registerUser({
      email: "  Buyer@Example.COM ",
      password: "correct horse battery staple 2026",
      displayName: " Buyer ",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    }, now);
    expect(result.userId).toBe("user-1");
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
    expect(txMock.verificationToken.create).not.toHaveBeenCalled();
    expect(txMock.role.findUnique).toHaveBeenCalledWith({ where: { key: "CUSTOMER" }, select: { id: true } });
    expect(txMock.userRoleAssignment.create).toHaveBeenCalledWith({
      data: { userId: "user-1", roleId: "customer-role-1", scopeType: "GLOBAL", scopeId: "GLOBAL" }
    });
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
    expect(txMock.role.findUnique).not.toHaveBeenCalled();
    expect(txMock.userRoleAssignment.create).not.toHaveBeenCalled();
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

  it("consumes a valid email challenge once and activates only the pending account", async () => {
    const token = "v".repeat(43);
    const expiresAt = new Date(now.getTime() + 60_000);
    txMock.verificationToken.findUnique.mockResolvedValue({
      id: "verification-1", userId: "user-1", purpose: "EMAIL_VERIFICATION",
      expiresAt, consumedAt: null
    });

    await expect(verifyUserEmail(token, now)).resolves.toBe(true);

    const digest = createHash("sha256").update(token, "utf8").digest("hex");
    expect(txMock.verificationToken.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: digest }
    }));
    expect(txMock.verificationToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "verification-1", purpose: "EMAIL_VERIFICATION", consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now }
    }));
    expect(txMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: UserStatus.PENDING },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: now }
    });
  });

  it("rejects an expired email challenge without changing account state", async () => {
    txMock.verificationToken.findUnique.mockResolvedValue({
      id: "verification-1", userId: "user-1", purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(now.getTime() - 1), consumedAt: null
    });

    await expect(verifyUserEmail("v".repeat(43), now)).resolves.toBe(false);
    expect(txMock.verificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.user.updateMany).not.toHaveBeenCalled();
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
