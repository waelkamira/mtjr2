import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@prisma/client";

const { prismaMock, consumeMock, clearMock, verifyMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    userSession: { create: vi.fn() },
    loginAttempt: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn()
  },
  consumeMock: vi.fn(),
  clearMock: vi.fn(),
  verifyMock: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/identity/login-throttle", () => ({
  consumeLoginAttempt: consumeMock,
  clearLoginThrottle: clearMock
}));
vi.mock("@/server/identity/password", () => ({ verifyPassword: verifyMock }));
vi.mock("@/server/identity/session", () => ({
  generateSessionToken: () => "s".repeat(43),
  hashSessionToken: () => "session-digest",
  SESSION_TTL_SECONDS: 30 * 24 * 60 * 60
}));

import { loginWithPassword } from "../../src/server/identity/login";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("password login service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeMock.mockResolvedValue({ blocked: false });
    verifyMock.mockResolvedValue(true);
    prismaMock.loginAttempt.create.mockResolvedValue({});
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.userSession.create.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    clearMock.mockResolvedValue(undefined);
  });

  it("issues a session only for an active, email-verified account and records the successful login", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "stored-hash",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: now
    });

    const result = await loginWithPassword({
      email: " Buyer@Example.COM ",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10",
      userAgent: "browser"
    }, now);

    expect(result).toMatchObject({ authenticated: true, userId: "user-1" });
    expect(verifyMock).toHaveBeenCalledWith("a-secure-password", "stored-hash");
    expect(prismaMock.userSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", tokenHash: "session-digest", userAgent: "browser" }) }));
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(clearMock).toHaveBeenCalledWith("buyer@example.com", "203.0.113.10");
  });

  it("uses the same generic response for unknown accounts without storing raw identifiers", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await loginWithPassword({
      email: "unknown@example.com",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    expect(verifyMock).toHaveBeenCalledOnce();
    expect(verifyMock.mock.calls[0][1]).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(prismaMock.userSession.create).not.toHaveBeenCalled();
    expect(prismaMock.loginAttempt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ succeeded: false, identifierHash: expect.any(String), ipHash: expect.any(String) })
    }));
  });

  it("uses the same generic response for an incorrect password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1", passwordHash: "stored-hash", status: UserStatus.ACTIVE, emailVerifiedAt: now
    });
    verifyMock.mockResolvedValue(false);

    const result = await loginWithPassword({
      email: "buyer@example.com", password: "wrong-password", trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({
      authenticated: false, reason: "INVALID_CREDENTIALS", message: "Email or password is incorrect."
    });
    expect(prismaMock.userSession.create).not.toHaveBeenCalled();
  });

  it("does not issue a session to an unverified or inactive account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-2",
      passwordHash: "stored-hash",
      status: UserStatus.SUSPENDED,
      emailVerifiedAt: now
    });

    const result = await loginWithPassword({
      email: "suspended@example.com",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
    expect(prismaMock.userSession.create).not.toHaveBeenCalled();
  });

  it("rejects a login if the password or account state changed after verification", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1", passwordHash: "old-hash", status: UserStatus.ACTIVE, emailVerifiedAt: now
    });
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
    const result = await loginWithPassword({
      email: "buyer@example.com", password: "old-password", trustedIpAddress: "203.0.113.10"
    }, now);
    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "user-1", passwordHash: "old-hash", status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } })
    }));
    expect(prismaMock.userSession.create).not.toHaveBeenCalled();
  });

  it("does not run password verification after the throttle blocks a request", async () => {
    consumeMock.mockResolvedValue({ blocked: true });

    const result = await loginWithPassword({
      email: "buyer@example.com",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10"
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
      email: "not-an-email",
      password: "password",
      trustedIpAddress: ""
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
    expect(consumeMock).not.toHaveBeenCalled();
  });
});
