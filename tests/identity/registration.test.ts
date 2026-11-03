import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentType, UserStatus } from "@prisma/client";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    user: { create: vi.fn(), updateMany: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    userConsent: { createMany: vi.fn() }
  };
  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    }
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  registerUser,
  verifyUserEmail
} from "../../src/server/identity/registration";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("registration and email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
  });

  it("creates a pending user, hashed password, one-time challenge, and required consents", async () => {
    txMock.user.create.mockResolvedValue({ id: "user-1" });
    txMock.verificationToken.create.mockResolvedValue({});
    txMock.userConsent.createMany.mockResolvedValue({ count: 2 });

    const result = await registerUser({
      email: "  Buyer@Example.COM ",
      password: "correct horse battery staple 2026",
      displayName: " Buyer ",
      acceptedTerms: true,
      acceptedPrivacy: true
    }, now);

    expect(result.userId).toBe("user-1");
    expect(result.verificationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(txMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "buyer@example.com",
        emailNormalized: "buyer@example.com",
        status: UserStatus.PENDING,
        displayName: "Buyer"
      })
    }));

    const createUserCall = txMock.user.create.mock.calls[0][0];
    expect(createUserCall.data.passwordHash).not.toContain("correct horse");
    expect(txMock.verificationToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        purpose: "EMAIL_VERIFICATION",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/)
      })
    }));

    expect(txMock.userConsent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ type: ConsentType.TERMS_OF_SERVICE, granted: true }),
        expect.objectContaining({ type: ConsentType.PRIVACY_POLICY, granted: true })
      ])
    });
  });

  it("rejects registration without explicit terms and privacy consent", async () => {
    await expect(registerUser({
      email: "buyer@example.com",
      password: "correct horse battery staple 2026",
      acceptedTerms: false,
      acceptedPrivacy: true
    } as never, now)).rejects.toThrow();

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("activates an account only after consuming a valid unexpired token", async () => {
    txMock.verificationToken.findUnique.mockResolvedValue({
      id: "verification-1",
      userId: "user-1",
      purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null
    });
    txMock.verificationToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(verifyUserEmail("x".repeat(43), now)).resolves.toBe(true);
    expect(txMock.verificationToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "verification-1",
        consumedAt: null,
        expiresAt: { gt: now }
      })
    }));
    expect(txMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: UserStatus.PENDING },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: now }
    });
  });

  it("rejects expired, consumed, wrong-purpose, and malformed challenges", async () => {
    await expect(verifyUserEmail("short", now)).resolves.toBe(false);
    expect(txMock.verificationToken.findUnique).not.toHaveBeenCalled();

    txMock.verificationToken.findUnique.mockResolvedValueOnce({
      id: "v1", userId: "u1", purpose: "EMAIL_VERIFICATION",
      expiresAt: now, consumedAt: null
    });
    await expect(verifyUserEmail("x".repeat(43), now)).resolves.toBe(false);

    txMock.verificationToken.findUnique.mockResolvedValueOnce({
      id: "v2", userId: "u1", purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(now.getTime() + 60_000), consumedAt: now
    });
    await expect(verifyUserEmail("x".repeat(43), now)).resolves.toBe(false);

    txMock.verificationToken.findUnique.mockResolvedValueOnce({
      id: "v3", userId: "u1", purpose: "PASSWORD_RESET",
      expiresAt: new Date(now.getTime() + 60_000), consumedAt: null
    });
    await expect(verifyUserEmail("x".repeat(43), now)).resolves.toBe(false);
    expect(txMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("does not activate an account if another request already consumed the token", async () => {
    txMock.verificationToken.findUnique.mockResolvedValue({
      id: "verification-1",
      userId: "user-1",
      purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null
    });
    txMock.verificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(verifyUserEmail("x".repeat(43), now)).resolves.toBe(false);
    expect(txMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("does not reactivate an account that is no longer pending", async () => {
    txMock.verificationToken.findUnique.mockResolvedValue({
      id: "verification-2",
      userId: "user-suspended",
      purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null
    });
    txMock.verificationToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(verifyUserEmail("y".repeat(43), now)).resolves.toBe(false);
    expect(txMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-suspended", status: UserStatus.PENDING },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: now }
    });
  });
});
