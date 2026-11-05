import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  oauthAccountFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
  createUserSession: vi.fn(),
  setSessionCookie: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    NODE_ENV: "production"
  },
  isPublicRegistrationEnabled: () => false
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthAccount: { findUnique: mocks.oauthAccountFindUnique },
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/server/identity/session", () => ({
  createUserSession: mocks.createUserSession
}));
vi.mock("@/server/identity/session-cookie", () => ({
  setSessionCookie: mocks.setSessionCookie
}));

import { GET } from "../../src/app/api/auth/google/callback/route";

function createCookieStore(values: Record<string, string>) {
  return {
    get: (name: string) => values[name] ? { value: values[name] } : undefined,
    set: vi.fn()
  };
}

function oauthCookies(intent: "login" | "register", returnTo = "/") {
  return createCookieStore({
    mtjr_google_state: "expected-state",
    mtjr_google_verifier: "verifier",
    mtjr_google_intent: intent,
    mtjr_google_account_type: "CUSTOMER",
    mtjr_google_terms: intent === "register" ? "v1" : "",
    mtjr_google_privacy: intent === "register" ? "v1" : "",
    mtjr_google_return_to: encodeURIComponent(returnTo)
  });
}

describe("Google OAuth registration gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue(oauthCookies("register"));
    mocks.oauthAccountFindUnique.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ id_token: "id-token" }))
      .mockResolvedValueOnce(Response.json({
        iss: "https://accounts.google.com",
        aud: "google-client",
        sub: "google-user",
        email: "new@example.com",
        email_verified: "true",
        exp: String(Math.floor(Date.now() / 1000) + 60)
      })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not create an OAuth account when public registration is disabled", async () => {
    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/callback?code=auth-code&state=expected-state"
    ));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/register?oauth=registration_unavailable"
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });

  it("allows an already-linked Google account to sign in while registration is disabled", async () => {
    mocks.cookies.mockResolvedValue(oauthCookies("login", "/checkout?step=delivery"));
    mocks.oauthAccountFindUnique.mockResolvedValue({
      userId: "existing-user",
      user: {
        id: "existing-user",
        status: "ACTIVE",
        emailVerifiedAt: new Date()
      }
    });
    mocks.transaction.mockResolvedValue(undefined);
    mocks.createUserSession.mockResolvedValue({
      token: "opaque-session-token",
      expiresAt: new Date(Date.now() + 60_000)
    });

    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/callback?code=auth-code&state=expected-state"
    ));

    expect(response.headers.get("location")).toBe("http://localhost:3000/checkout?step=delivery");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.createUserSession).toHaveBeenCalledWith(
      "existing-user",
      { userAgent: null },
      expect.any(Date)
    );
    expect(mocks.setSessionCookie).toHaveBeenCalled();
  });

  it("does not create or link an unlinked Google account during a login-only flow", async () => {
    mocks.cookies.mockResolvedValue(oauthCookies("login"));

    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/callback?code=auth-code&state=expected-state"
    ));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login?oauth=not_linked");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });

  it("does not auto-link a Google login to an existing password account", async () => {
    mocks.cookies.mockResolvedValue(oauthCookies("login"));
    mocks.userFindUnique.mockResolvedValue({ id: "password-user" });

    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/callback?code=auth-code&state=expected-state"
    ));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login?oauth=link_required");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });
});
