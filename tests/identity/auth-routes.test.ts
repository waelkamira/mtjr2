import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  setSessionCookie: vi.fn(),
  resolveTrustedClientIp: vi.fn(),
  validateIdentityMutationRequest: vi.fn(),
  registerUser: vi.fn(),
  consumeRegistrationAttempt: vi.fn(),
  verifyRegistrationChallenge: vi.fn(),
  createUserSession: vi.fn(),
  revokeUserSession: vi.fn(),
  isPublicRegistrationEnabled: vi.fn()
}));

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "development",
    TRUSTED_PROXY_IP_HEADER: undefined,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site"
  },
  isPublicRegistrationEnabled: mocks.isPublicRegistrationEnabled
}));
vi.mock("@/server/identity/session-cookie", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("@/server/identity/session", () => ({ createUserSession: mocks.createUserSession, revokeUserSession: mocks.revokeUserSession }));
vi.mock("@/server/identity/login", () => ({ loginWithPassword: mocks.loginWithPassword }));
vi.mock("@/server/identity/login-throttle", () => ({ consumeRegistrationAttempt: mocks.consumeRegistrationAttempt }));
vi.mock("@/server/identity/turnstile", () => ({ verifyRegistrationChallenge: mocks.verifyRegistrationChallenge }));
vi.mock("@/server/identity/trusted-client-ip", () => ({ resolveTrustedClientIp: mocks.resolveTrustedClientIp }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validateIdentityMutationRequest }));
vi.mock("@/server/identity/registration", () => ({
  IdentityConflictError: class IdentityConflictError extends Error {},
  registerUser: mocks.registerUser
}));
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";

function request(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", "User-Agent": "Vitest browser" },
    body: JSON.stringify(body)
  });
}

describe("identity HTTP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateIdentityMutationRequest.mockReturnValue(null);
    mocks.isPublicRegistrationEnabled.mockReturnValue(true);
    mocks.resolveTrustedClientIp.mockReturnValue("127.0.0.1");
    mocks.loginWithPassword.mockResolvedValue({
      authenticated: true,
      userId: "user-1",
      session: { token: "session-token", expiresAt: new Date("2026-11-06T00:00:00.000Z") },
      mfaRequired: false,
      mfaSetupRequired: false
    });
    mocks.registerUser.mockResolvedValue({ userId: "user-1" });
    mocks.consumeRegistrationAttempt.mockResolvedValue({ blocked: false });
    mocks.verifyRegistrationChallenge.mockResolvedValue(true);
    mocks.createUserSession.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-11-06T00:00:00.000Z")
    });
    mocks.revokeUserSession.mockResolvedValue(true);
  });

  it("issues the session cookie after a successful password login", async () => {
    const response = await login(request("/api/auth/login", {
      email: "buyer@example.test",
      password: "A-correct-password"
    }));

    expect(response.status).toBe(200);
    expect(mocks.loginWithPassword).toHaveBeenCalledWith(expect.objectContaining({
      email: "buyer@example.test",
      password: "A-correct-password",
      trustedIpAddress: "127.0.0.1"
    }));
    expect(mocks.setSessionCookie).toHaveBeenCalledOnce();
  });

  it("does not issue a cookie for invalid credentials", async () => {
    mocks.loginWithPassword.mockResolvedValue({
      authenticated: false,
      reason: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });

    const response = await login(request("/api/auth/login", {
      email: "buyer@example.test",
      password: "incorrect"
    }));

    expect(response.status).toBe(401);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("uses the same public error code for unknown-account and incorrect-password failures", async () => {
    mocks.loginWithPassword.mockResolvedValue({
      authenticated: false,
      reason: "EMAIL_NOT_FOUND",
      message: "Email or password is incorrect."
    });

    const response = await login(request("/api/auth/login", {
      email: "unknown@example.test",
      password: "incorrect"
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Email or password is incorrect.",
      code: "INVALID_CREDENTIALS"
    });
  });

  it("sets a session cookie but does not signal completed sign-in before MFA", async () => {
    mocks.loginWithPassword.mockResolvedValue({
      authenticated: true,
      userId: "admin-1",
      session: { token: "session-token", expiresAt: new Date("2026-11-06T00:00:00.000Z") },
      mfaRequired: true,
      mfaSetupRequired: false
    });

    const response = await login(request("/api/auth/login", {
      email: "admin@example.test",
      password: "A-correct-password"
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mfaRequired: true });
    expect(mocks.setSessionCookie).toHaveBeenCalledOnce();
  });

  it("creates an active account and immediately issues an authenticated session", async () => {
    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      password: "A-correct-password",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true,
      turnstileToken: "valid-token"
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ message: "Account created. Signed in successfully.", signedIn: true });
    expect(mocks.verifyRegistrationChallenge).toHaveBeenCalledWith("valid-token", "127.0.0.1");
    expect(mocks.registerUser).toHaveBeenCalledOnce();
    expect(mocks.createUserSession).toHaveBeenCalledWith("user-1", { ipAddress: "127.0.0.1", userAgent: "Vitest browser" });
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token", new Date("2026-11-06T00:00:00.000Z"));
  });

  it("returns a recoverable sign-in response when session creation fails after account creation", async () => {
    mocks.createUserSession.mockRejectedValueOnce(new Error("session store unavailable"));
    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      password: "A-correct-password",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true,
      turnstileToken: "valid-token"
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ message: "Account created. Sign in to continue.", signedIn: false });
    expect(mocks.registerUser).toHaveBeenCalledOnce();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.revokeUserSession).not.toHaveBeenCalled();
  });

  it("revokes the new session and returns a sign-in response when setting its cookie fails", async () => {
    mocks.setSessionCookie.mockRejectedValueOnce(new Error("cookie unavailable"));
    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      password: "A-correct-password",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true,
      turnstileToken: "valid-token"
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ message: "Account created. Sign in to continue.", signedIn: false });
    expect(mocks.revokeUserSession).toHaveBeenCalledWith("session-token");
  });

  it("rejects a failed bot challenge without creating an account", async () => {
    mocks.verifyRegistrationChallenge.mockResolvedValue(false);
    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      password: "A-correct-password",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true,
      turnstileToken: "invalid-token"
    }));

    expect(response.status).toBe(400);
    expect(mocks.registerUser).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects rate-limited registration attempts before checking the bot challenge", async () => {
    mocks.consumeRegistrationAttempt.mockResolvedValue({ blocked: true });
    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      turnstileToken: "valid-token"
    }));

    expect(response.status).toBe(429);
    expect(mocks.verifyRegistrationChallenge).not.toHaveBeenCalled();
    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it("returns a conflict for a duplicate email without issuing a session", async () => {
    const { IdentityConflictError } = await import("@/server/identity/registration");
    mocks.registerUser.mockRejectedValue(new IdentityConflictError());

    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      password: "A-correct-password",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true,
      turnstileToken: "valid-token"
    }));

    expect(response.status).toBe(409);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("stops registration before the service when the public-registration gate is disabled", async () => {
    mocks.isPublicRegistrationEnabled.mockReturnValue(false);

    const response = await register(request("/api/auth/register", {}));

    expect(response.status).toBe(503);
    expect(mocks.registerUser).not.toHaveBeenCalled();
  });
});
