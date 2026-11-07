import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieMock,
  clearCookieMock,
  resolveMock,
  revokeMock,
  revokeAllMock,
  requireCurrentMock,
  auditCreateMock
} = vi.hoisted(() => ({
  cookieMock: vi.fn(),
  clearCookieMock: vi.fn(),
  resolveMock: vi.fn(),
  revokeMock: vi.fn(),
  revokeAllMock: vi.fn(),
  requireCurrentMock: vi.fn(),
  auditCreateMock: vi.fn()
}));

vi.mock("@/server/identity/session-cookie", () => ({
  getSessionCookie: cookieMock,
  clearSessionCookie: clearCookieMock
}));
vi.mock("@/server/identity/session", () => ({
  resolveUserSession: resolveMock,
  revokeUserSession: revokeMock,
  revokeAllUserSessions: revokeAllMock
}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: requireCurrentMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { auditLog: { create: auditCreateMock } }
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
    requireCurrentMock.mockResolvedValue(session);
    revokeAllMock.mockResolvedValue(3);
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
    requireCurrentMock.mockResolvedValue(session);
    revokeAllMock.mockResolvedValue(3);
  });

  it("revokes all sessions for the authenticated user, audits the action, and clears the current cookie", async () => {
    await expect(logoutAllSessions(now)).resolves.toBe(3);
    expect(requireCurrentMock).toHaveBeenCalledWith(now);
    expect(revokeAllMock).toHaveBeenCalledWith("user-1", now);
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "identity.logout_all.succeeded",
        resource: "user_session",
        resourceId: "session-1",
        metadata: { revokedSessions: 3 }
      })
    });
    expect(clearCookieMock).toHaveBeenCalledOnce();
  });

  it("does not clear the cookie or revoke sessions when authentication is not valid", async () => {
    requireCurrentMock.mockRejectedValue(new Error("not authenticated"));
    await expect(logoutAllSessions(now)).rejects.toThrow("not authenticated");
    expect(revokeAllMock).not.toHaveBeenCalled();
    expect(clearCookieMock).not.toHaveBeenCalled();
  });
});
