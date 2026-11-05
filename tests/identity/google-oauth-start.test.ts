import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    NODE_ENV: "development"
  }
}));

import { GET } from "@/app/api/auth/google/start/route";

describe("Google OAuth start", () => {
  const setCookie = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ set: setCookie });
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
});
