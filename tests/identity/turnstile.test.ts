import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "https://shop.example",
    NODE_ENV: "development",
    TURNSTILE_SECRET_KEY: "server-secret"
  }
}));

import { env } from "@/lib/env";
import { verifyRegistrationChallenge } from "@/server/identity/turnstile";

describe("registration Turnstile verification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    env.NODE_ENV = "development";
    env.TURNSTILE_SECRET_KEY = "server-secret";
  });

  it("checks the provider response, registration action, hostname, and sends the trusted IP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: "registration", hostname: "shop.example" })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyRegistrationChallenge("challenge-token", "203.0.113.8")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    const form = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(form.get("secret")).toBe("server-secret");
    expect(form.get("response")).toBe("challenge-token");
    expect(form.get("remoteip")).toBe("203.0.113.8");
  });

  it("rejects unsuccessful challenges, unexpected actions, and unexpected hostnames", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, action: "login", hostname: "shop.example" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, action: "registration", hostname: "evil.example" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyRegistrationChallenge("bad", "203.0.113.8")).resolves.toBe(false);
    await expect(verifyRegistrationChallenge("wrong-action", "203.0.113.8")).resolves.toBe(false);
    await expect(verifyRegistrationChallenge("wrong-host", "203.0.113.8")).resolves.toBe(false);
  });

  it("accepts Cloudflare's documented dummy response only in local development", async () => {
    env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, hostname: "example.com" })
    }));

    await expect(verifyRegistrationChallenge("XXXX.DUMMY.TOKEN.XXXX", "127.0.0.1"))
      .resolves.toBe(true);

    env.NODE_ENV = "production";
    await expect(verifyRegistrationChallenge("XXXX.DUMMY.TOKEN.XXXX", "127.0.0.1"))
      .resolves.toBe(false);
  });

  it("surfaces provider failures instead of accepting an unavailable challenge", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(verifyRegistrationChallenge("challenge-token", "203.0.113.8"))
      .rejects.toThrow("Turnstile verification returned HTTP 503.");
  });
});
