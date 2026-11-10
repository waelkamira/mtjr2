import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  isValidRegistrationChallengeCookie: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters",
    NODE_ENV: "development"
  }
}));
vi.mock("@/server/identity/registration-challenge", () => ({
  REGISTRATION_CHALLENGE_COOKIE: "mtjr_registration_challenge",
  isValidRegistrationChallengeCookie: mocks.isValidRegistrationChallengeCookie
}));

import { GET } from "@/app/api/auth/google/start/route";

describe("Google OAuth start", () => {
  const setCookie = vi.fn();
  const getCookie = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: getCookie, set: setCookie });
    getCookie.mockReturnValue(undefined);
    mocks.isValidRegistrationChallengeCookie.mockReturnValue(false);
  });

  it("starts a login-only PKCE flow and stores a safe return path", async () => {
    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/start?intent=login&returnTo=%2Fcart%3Fstep%3Ddelivery"
    ));

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.pathname).toBe("/o/oauth2/v2/auth");
    expect(location.searchParams.get("client_id")).toBe("google-client");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(setCookie).toHaveBeenCalledWith("mtjr_google_intent", "login", expect.any(Object));
    expect(setCookie).toHaveBeenCalledWith(
      "mtjr_google_return_to",
      encodeURIComponent("/cart?step=delivery"),
      expect.any(Object)
    );
    expect(setCookie).toHaveBeenCalledWith("mtjr_google_terms", "", expect.any(Object));
    expect(setCookie).toHaveBeenCalledWith("mtjr_google_privacy", "", expect.any(Object));
  });

  it("rejects unsupported OAuth intents before setting cookies", async () => {
    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/start?intent=admin"
    ));

    expect(response.status).toBe(400);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("requires a verified registration challenge before starting Google sign-up", async () => {
    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/start?intent=register&accountType=CUSTOMER&acceptedTerms=1&acceptedPrivacy=1&returnTo=%2Fproducts%2Fchair%3Fcolor%3Dblue"
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/register?oauth=challenge_required&returnTo=%2Fproducts%2Fchair%3Fcolor%3Dblue"
    );
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("consumes the verified challenge when starting Google sign-up", async () => {
    getCookie.mockReturnValue({ value: "signed-challenge" });
    mocks.isValidRegistrationChallengeCookie.mockReturnValue(true);

    const response = await GET(new Request(
      "http://localhost:3000/api/auth/google/start?intent=register&accountType=CUSTOMER&acceptedTerms=1&acceptedPrivacy=1"
    ));

    expect(response.status).toBe(302);
    expect(mocks.isValidRegistrationChallengeCookie).toHaveBeenCalledWith("signed-challenge");
    expect(setCookie).toHaveBeenCalledWith("mtjr_registration_challenge", "", expect.objectContaining({
      maxAge: 0,
      path: "/api/auth"
    }));
  });
});
