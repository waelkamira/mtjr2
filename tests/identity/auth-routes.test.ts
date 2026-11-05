import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  setSessionCookie: vi.fn(),
  resolveTrustedClientIp: vi.fn(),
  validateIdentityMutationRequest: vi.fn(),
  registerUser: vi.fn(),
  sendVerificationEmail: vi.fn(),
  isPublicRegistrationEnabled: vi.fn()
}));

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "development", TRUSTED_PROXY_IP_HEADER: undefined },
  isPublicRegistrationEnabled: mocks.isPublicRegistrationEnabled
}));
vi.mock("@/server/identity/session-cookie", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("@/server/identity/login", () => ({ loginWithPassword: mocks.loginWithPassword }));
vi.mock("@/server/identity/trusted-client-ip", () => ({ resolveTrustedClientIp: mocks.resolveTrustedClientIp }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validateIdentityMutationRequest }));
vi.mock("@/server/identity/registration", () => ({
  IdentityConflictError: class IdentityConflictError extends Error {},
  registerUser: mocks.registerUser
}));
vi.mock("@/server/email/resend", () => ({
  resendEmailAdapter: { sendVerificationEmail: mocks.sendVerificationEmail }
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";

function request(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
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
      session: { token: "session-token", expiresAt: new Date("2026-11-06T00:00:00.000Z") }
    });
    mocks.registerUser.mockResolvedValue({
      userId: "user-1",
      verificationToken: "verification-token",
      verificationExpiresAt: new Date("2026-11-06T00:00:00.000Z")
    });
    mocks.sendVerificationEmail.mockResolvedValue(undefined);
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

  it("keeps duplicate email responses generic and never sends another verification email", async () => {
    const { IdentityConflictError } = await import("@/server/identity/registration");
    mocks.registerUser.mockRejectedValue(new IdentityConflictError());

    const response = await register(request("/api/auth/register", {
      email: "buyer@example.test",
      password: "A-correct-password",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    }));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      message: "If eligible, this account can be verified. Sign in or request another verification email."
    });
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("stops registration before the service when the public-registration gate is disabled", async () => {
    mocks.isPublicRegistrationEnabled.mockReturnValue(false);

    const response = await register(request("/api/auth/register", {}));

    expect(response.status).toBe(503);
    expect(mocks.registerUser).not.toHaveBeenCalled();
  });
});
