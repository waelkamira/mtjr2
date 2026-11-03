import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    userSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  createUserSession,
  hashSessionToken,
  resolveUserSession,
  revokeAllUserSessions,
  revokeUserSession
} from "../../src/server/identity/session";

const fixedNow = new Date("2026-11-03T12:00:00.000Z");

describe("database-backed session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates sessions only for active users and stores only a token digest", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      status: UserStatus.ACTIVE
    });
    prismaMock.userSession.create.mockResolvedValue({});

    const created = await createUserSession(
      "user-1",
      { ipAddress: "127.0.0.1", userAgent: "test-agent" },
      fixedNow
    );

    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.expiresAt.getTime()).toBe(
      fixedNow.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    const data = prismaMock.userSession.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashSessionToken(created.token));
    expect(data.tokenHash).not.toBe(created.token);
    expect(data.userId).toBe("user-1");
  });

  it("does not create a session for a pending or missing user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      status: UserStatus.PENDING
    });

    await expect(createUserSession("user-1", {}, fixedNow)).rejects.toThrow(
      /Only active accounts/
    );
    expect(prismaMock.userSession.create).not.toHaveBeenCalled();
  });

  it("resolves an active, unexpired, unrevoked session", async () => {
    const expiresAt = new Date(fixedNow.getTime() + 60_000);
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      expiresAt,
      revokedAt: null,
      user: {
        id: "user-1",
        email: "buyer@example.com",
        displayName: "Buyer",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: fixedNow
      }
    });
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 1 });

    const session = await resolveUserSession("x".repeat(43), fixedNow);

    expect(session?.userId).toBe("user-1");
    expect(prismaMock.userSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashSessionToken("x".repeat(43)) }
      })
    );
    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", revokedAt: null, expiresAt: { gt: fixedNow } }
      })
    );
  });

  it("fails closed for expired, revoked, and inactive-account sessions", async () => {
    const base = {
      id: "session-1",
      userId: "user-1",
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      revokedAt: null,
      user: {
        id: "user-1",
        email: "buyer@example.com",
        displayName: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: fixedNow
      }
    };

    prismaMock.userSession.findUnique.mockResolvedValueOnce({
      ...base,
      expiresAt: fixedNow
    });
    await expect(resolveUserSession("x".repeat(43), fixedNow)).resolves.toBeNull();

    prismaMock.userSession.findUnique.mockResolvedValueOnce({
      ...base,
      revokedAt: fixedNow
    });
    await expect(resolveUserSession("x".repeat(43), fixedNow)).resolves.toBeNull();

    prismaMock.userSession.findUnique.mockResolvedValueOnce({
      ...base,
      user: { ...base.user, status: UserStatus.SUSPENDED }
    });
    await expect(resolveUserSession("x".repeat(43), fixedNow)).resolves.toBeNull();
  });

  it("fails closed when revocation wins the concurrent last-seen update", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      revokedAt: null,
      user: {
        id: "user-1",
        email: "buyer@example.com",
        displayName: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: fixedNow
      }
    });
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(resolveUserSession("x".repeat(43), fixedNow)).resolves.toBeNull();
  });

  it("revokes one session using its token digest", async () => {
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(revokeUserSession("x".repeat(43), fixedNow)).resolves.toBe(true);
    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashSessionToken("x".repeat(43)), revokedAt: null },
        data: { revokedAt: fixedNow }
      })
    );
  });

  it("revokes all active sessions for one user", async () => {
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 3 });

    await expect(revokeAllUserSessions("user-1", fixedNow)).resolves.toBe(3);
    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: fixedNow }
    });
  });
});
