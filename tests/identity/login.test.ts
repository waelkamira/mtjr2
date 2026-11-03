import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@prisma/client";

const { prismaMock, consumeMock, clearMock, verifyMock, createSessionMock, revokeMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    loginAttempt: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn()
  },
  consumeMock: vi.fn(),
  clearMock: vi.fn(),
  verifyMock: vi.fn(),
  createSessionMock: vi.fn(),
  revokeMock: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/identity/login-throttle", () => ({
  consumeLoginAttempt: consumeMock,
  clearLoginThrottle: clearMock
}));
vi.mock("@/server/identity/password", () => ({ verifyPassword: verifyMock }));
vi.mock("@/server/identity/session", () => ({
  createUserSession: createSessionMock,
  revokeUserSession: revokeMock
}));

import { loginWithPassword } from "../../src/server/identity/login";

const now = new Date("2026-11-03T12:00:00.000Z");

describe("password login service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeMock.mockResolvedValue({ blocked: false });
    verifyMock.mockResolvedValue(true);
    createSessionMock.mockResolvedValue({ token: "s".repeat(43), expiresAt: new Date(now.getTime() + 1000) });
    prismaMock.loginAttempt.create.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    prismaMock.$transaction.mockResolvedValue([]);
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
    expect(createSessionMock).toHaveBeenCalledWith("user-1", { userAgent: "browser" }, now);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(clearMock).toHaveBeenCalledWith("buyer@example.com", "203.0.113.10");
  });

  it("performs dummy password verification and returns the same failure for an unknown account", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await loginWithPassword({
      email: "unknown@example.com",
      password: "a-secure-password",
      trustedIpAddress: "203.0.113.10"
    }, now);

    expect(result).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
    expect(verifyMock).toHaveBeenCalledOnce();
    expect(verifyMock.mock.calls[0][1]).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(createSessionMock).not.toHaveBeenCalled();
    expect(prismaMock.loginAttempt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ succeeded: false, userId: null })
    }));
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
    expect(createSessionMock).not.toHaveBeenCalled();
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
