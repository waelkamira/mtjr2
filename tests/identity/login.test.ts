import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@prisma/client";

const { prismaMock, txMock, consumeMock, clearMock, verifyMock, mfaStateMock } = vi.hoisted(() => {
  const tx = {
    user: { updateMany: vi.fn() },
    userSession: { create: vi.fn() },
    verificationToken: { updateMany: vi.fn() },
    loginAttempt: { create: vi.fn() },
    auditLog: { create: vi.fn() }
  };
  return {
    txMock: tx,
    prismaMock: {
      user: { findUnique: vi.fn() },
      loginAttempt: { create: vi.fn() },
      $transaction: vi.fn()
    },
    consumeMock: vi.fn(),
    clearMock: vi.fn(),
    verifyMock: vi.fn(),
    mfaStateMock: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/identity/login-throttle", () => ({
  consumeLoginAttempt: consumeMock,
  clearLoginThrottle: clearMock
}));
vi.mock("@/server/identity/password", () => ({ verifyPassword: verifyMock }));
vi.mock("@/server/identity/session", () => ({
  generateSessionToken: () => "s".repeat(43),
  hashSessionToken: () => "token-hash",
  SESSION_TTL_SECONDS: 60 * 60 * 24 * 30
}));
vi.mock("@/server/identity/mfa", () => ({ getMfaAccessState: mfaStateMock }));

import { loginWithPassword } from "../../src/server/identity/login";

const now = new Date("2026-11-03T12:00:00.000Z");
const verifiedAt = new Date("2026-11-02T12:00:00.000Z");

describe("password login service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeMock.mockResolvedValue({ blocked: false });
    verifyMock.mockResolvedValue(true);
    prismaMock.loginAttempt.create.mockResolvedValue({});
    txMock.user.updateMany.mockResolvedValue({ count: 1 });
    txMock.userSession.create.mockResolvedValue({});
    txMock.loginAttempt.create.mockResolvedValue({});
    txMock.auditLog.create.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation((callback: (client: typeof txMock) => unknown) => callback(txMock));
    clearMock.mockResolvedValue(undefined);
    mfaStateMock.mockResolvedValue({
      enabled: false,
      required: false,
      platformRequired: false,
      enrollmentRequired: false
    });
  });

  it("issues a session for an active account without requiring email verification", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "stored-hash",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null
    });

    const result = await loginWithPassword({
      email: " Buyer@Example.COM ",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10",
      userAgent: "browser"
    }, now);

    expect(result).toMatchObject({
      authenticated: true,
      userId: "user-1",
      mfaRequired: false,
      mfaSetupRequired: false,
      session: { token: "s".repeat(43), expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
    });
    expect(verifyMock).toHaveBeenCalledWith("a-secure-password", "stored-hash");
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(txMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: UserStatus.ACTIVE, passwordHash: "stored-hash" },
      data: { status: UserStatus.ACTIVE, lastLoginAt: now }
    });
    expect(txMock.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenHash: "token-hash",
        ipAddress: "203.0.113.10",
        userAgent: "browser"
      })
    });
    expect(clearMock).toHaveBeenCalledWith("buyer@example.com", "203.0.113.10");
  });

  it("performs dummy password verification and records an unknown-account failure without storing raw identifiers", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await loginWithPassword({
      email: "unknown@example.com",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({
      authenticated: false,
      reason: "EMAIL_NOT_FOUND",
      message: "Email or password is incorrect."
    });
    expect(verifyMock).toHaveBeenCalledOnce();
    expect(verifyMock.mock.calls[0][1]).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(txMock.userSession.create).not.toHaveBeenCalled();
    expect(prismaMock.loginAttempt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ succeeded: false, identifierHash: expect.any(String), ipHash: expect.any(String) })
    }));
  });

  it("identifies an incorrect password for an existing verified account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1", passwordHash: "stored-hash", status: UserStatus.ACTIVE, emailVerifiedAt: verifiedAt
    });
    verifyMock.mockResolvedValue(false);

    const result = await loginWithPassword({
      email: "buyer@example.com", password: "wrong-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({
      authenticated: false, reason: "INVALID_PASSWORD", message: "Email or password is incorrect."
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does not issue a session to an inactive account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-2", passwordHash: "stored-hash", status: UserStatus.SUSPENDED, emailVerifiedAt: verifiedAt
    });

    const result = await loginWithPassword({
      email: "suspended@example.com", password: "a-secure-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
    expect(txMock.userSession.create).not.toHaveBeenCalled();
  });

  it("activates a legacy pending account only after successful password verification", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-pending", passwordHash: "stored-hash", status: UserStatus.PENDING, emailVerifiedAt: null
    });

    const result = await loginWithPassword({
      email: "pending@example.com", password: "a-secure-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: true, userId: "user-pending" });
    expect(txMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-pending", status: UserStatus.PENDING, passwordHash: "stored-hash" },
      data: { status: UserStatus.ACTIVE, lastLoginAt: now }
    });
    expect(txMock.verificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-pending", purpose: "EMAIL_VERIFICATION", consumedAt: null },
      data: { consumedAt: now }
    });
    expect(txMock.userSession.create).toHaveBeenCalledOnce();
  });

  it("does not activate a legacy pending account when its password is incorrect", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-pending", passwordHash: "stored-hash", status: UserStatus.PENDING, emailVerifiedAt: null
    });
    verifyMock.mockResolvedValue(false);

    const result = await loginWithPassword({
      email: "pending@example.com", password: "wrong-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_PASSWORD" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.userSession.create).not.toHaveBeenCalled();
    expect(txMock.verificationToken.updateMany).not.toHaveBeenCalled();
  });

  it("requires a second-factor challenge for an enrolled account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-mfa", passwordHash: "stored-hash", status: UserStatus.ACTIVE, emailVerifiedAt: verifiedAt
    });
    mfaStateMock.mockResolvedValue({
      enabled: true, required: true, platformRequired: true, enrollmentRequired: false
    });

    const result = await loginWithPassword({
      email: "admin@example.com", password: "a-secure-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: true, mfaRequired: true, mfaSetupRequired: false });
  });

  it("requires platform administrators without MFA to enroll before using privileged routes", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-admin", passwordHash: "stored-hash", status: UserStatus.ACTIVE, emailVerifiedAt: verifiedAt
    });
    mfaStateMock.mockResolvedValue({
      enabled: false, required: true, platformRequired: true, enrollmentRequired: true
    });

    const result = await loginWithPassword({
      email: "admin@example.com", password: "a-secure-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: true, mfaRequired: false, mfaSetupRequired: true });
  });

  it("does not run password verification after the throttle blocks a request", async () => {
    consumeMock.mockResolvedValue({ blocked: true });

    const result = await loginWithPassword({
      email: "buyer@example.com", password: "a-secure-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "RATE_LIMITED" });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.loginAttempt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ succeeded: false })
    }));
  });

  it("rejects malformed input before touching the database", async () => {
    const result = await loginWithPassword({
      email: "not-an-email", password: "password", trustedIpAddress: ""
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
    expect(consumeMock).not.toHaveBeenCalled();
  });
});
