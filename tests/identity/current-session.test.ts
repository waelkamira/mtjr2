import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@prisma/client";

const { getCookieMock, resolveMock } = vi.hoisted(() => ({
  getCookieMock: vi.fn(),
  resolveMock: vi.fn()
}));

vi.mock("@/server/identity/session-cookie", () => ({
  getSessionCookie: getCookieMock
}));
vi.mock("@/server/identity/session", () => ({
  resolveUserSession: resolveMock
}));

import {
  AuthenticationRequiredError,
  getCurrentSession,
  requireCurrentSession
} from "../../src/server/identity/current-session";

const now = new Date("2026-11-03T12:00:00.000Z");
const activeSession = {
  id: "session-1",
  userId: "user-1",
  expiresAt: new Date(now.getTime() + 60_000),
  user: {
    id: "user-1",
    email: "buyer@example.com",
    displayName: "Buyer",
    status: UserStatus.ACTIVE,
    emailVerifiedAt: now
  }
};

describe("request-bound current session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the HttpOnly cookie without accepting client-supplied identity", async () => {
    getCookieMock.mockResolvedValue("opaque-session-token");
    resolveMock.mockResolvedValue(activeSession);

    await expect(getCurrentSession(now)).resolves.toEqual(activeSession);
    expect(resolveMock).toHaveBeenCalledWith("opaque-session-token", now);
    expect(getCookieMock).toHaveBeenCalledOnce();
  });

  it("does not query the session store when no cookie exists", async () => {
    getCookieMock.mockResolvedValue(null);

    await expect(getCurrentSession(now)).resolves.toBeNull();
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("fails closed when a protected server operation has no valid session", async () => {
    getCookieMock.mockResolvedValue("stale-cookie");
    resolveMock.mockResolvedValue(null);

    await expect(requireCurrentSession(now)).rejects.toBeInstanceOf(
      AuthenticationRequiredError
    );
  });

  it("returns the authenticated session for a protected server operation", async () => {
    getCookieMock.mockResolvedValue("opaque-session-token");
    resolveMock.mockResolvedValue(activeSession);

    await expect(requireCurrentSession(now)).resolves.toEqual(activeSession);
  });
});
