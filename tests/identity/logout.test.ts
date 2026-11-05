import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieMock,
  clearCookieMock,
  resolveMock,
  revokeMock,
  auditCreateMock,
  sessionUpdateManyMock
} = vi.hoisted(() => ({
  cookieMock: vi.fn(),
  clearCookieMock: vi.fn(),
  resolveMock: vi.fn(),
  revokeMock: vi.fn(),
  auditCreateMock: vi.fn(),
  sessionUpdateManyMock: vi.fn()
}));

vi.mock("@/server/identity/session-cookie", () => ({
  getSessionCookie: cookieMock,
  clearSessionCookie: clearCookieMock
}));
vi.mock("@/server/identity/session", () => ({
  resolveUserSession: resolveMock,
  revokeUserSession: revokeMock
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { auditLog: { create: auditCreateMock }, userSession: { updateMany: sessionUpdateManyMock } }
}));

import { logoutAllSessions, logoutCurrentSession } from "../../src/server/identity/logout";

const now = new Date("2026-11-03T12:00:00.000Z");
const session = {
  id: "session-1",
  userId: "user-1",
  expiresAt: new Date(now.getTime() + 60_000),
  user: { id: "user-1" }
};

describe("logoutCurrentSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCookieMock.mockResolvedValue(undefined);
    auditCreateMock.mockResolvedValue({});
    sessionUpdateManyMock.mockResolvedValue({ count: 3 });
  });

  it("revokes the current session, audits it, and clears the cookie", async () => {
    cookieMock.mockResolvedValue("opaque-session-token");
    resolveMock.mockResolvedValue(session);
    revokeMock.mockResolvedValue(true);

    await expect(logoutCurrentSession(now)).resolves.toBeUndefined();

    expect(resolveMock).toHaveBeenCalledWith("opaque-session-token", now);
    expect(revokeMock).toHaveBeenCalledWith("opaque-session-token", now);
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "identity.logout.succeeded",
        resourceId: "session-1"
      })
    });
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });

  it("clears the cookie when no session token exists", async () => {
    cookieMock.mockResolvedValue(null);

    await logoutCurrentSession(now);

    expect(resolveMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });

  it("clears the cookie for an expired or already invalid session", async () => {
    cookieMock.mockResolvedValue("expired-session-token");
    resolveMock.mockResolvedValue(null);
    revokeMock.mockResolvedValue(false);

    await logoutCurrentSession(now);

    expect(auditCreateMock).not.toHaveBeenCalled();
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });

  it("clears the cookie even if server-side revocation fails", async () => {
    cookieMock.mockResolvedValue("opaque-session-token");
    resolveMock.mockResolvedValue(session);
    revokeMock.mockRejectedValue(new Error("database unavailable"));

    await expect(logoutCurrentSession(now)).rejects.toThrow("database unavailable");
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });
});


describe("logoutAllSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCookieMock.mockResolvedValue(undefined);
    auditCreateMock.mockResolvedValue({});
    sessionUpdateManyMock.mockResolvedValue({ count: 3 });
  });

  it("revokes all sessions for the cookie-authenticated account and clears the cookie", async () => {
    cookieMock.mockResolvedValue("opaque-session-token");
    resolveMock.mockResolvedValue(session);

    await expect(logoutAllSessions(now)).resolves.toBe(3);
    expect(sessionUpdateManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: now }
    });
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "identity.logout_all.succeeded",
        resourceId: "user-1",
        metadata: { revokedSessionCount: 3 }
      })
    });
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });

  it("clears the cookie without revoking arbitrary sessions when no valid session exists", async () => {
    cookieMock.mockResolvedValue("invalid-session-token");
    resolveMock.mockResolvedValue(null);

    await expect(logoutAllSessions(now)).resolves.toBe(0);
    expect(sessionUpdateManyMock).not.toHaveBeenCalled();
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });
});
