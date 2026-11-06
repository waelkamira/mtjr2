import { afterEach, describe, expect, it, vi } from "vitest";

const baseEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mtjr2_test?schema=public",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "a-test-only-secret-with-at-least-32-characters",
  NODE_ENV: "test"
};

describe("Groq provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails closed without contacting Groq when disabled", async () => {
    Object.entries({ ...baseEnv, AI_ASSISTANT_ENABLED: "false" }).forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn();
    const { completeWithGroq } = await import("../../src/server/ai/groq-provider");
    await expect(completeWithGroq([{ role: "user", content: "hello" }], fetcher as typeof fetch))
      .rejects.toMatchObject({ code: "disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends the secret only as a server-side authorization header", async () => {
    Object.entries({
      ...baseEnv,
      AI_ASSISTANT_ENABLED: "true",
      GROQ_API_KEY: "test-groq-secret",
      GROQ_MODEL: "test-model"
    }).forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content: "  مرحباً  " } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const { completeWithGroq } = await import("../../src/server/ai/groq-provider");
    await expect(completeWithGroq([{ role: "user", content: "hello" }], fetcher as typeof fetch))
      .resolves.toBe("مرحباً");
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer test-groq-secret");
    expect(JSON.stringify(request.body)).not.toContain("test-groq-secret");
  });

  it("maps quota exhaustion to a safe rate-limit error", async () => {
    Object.entries({ ...baseEnv, AI_ASSISTANT_ENABLED: "true", GROQ_API_KEY: "test-secret" })
      .forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    const { completeWithGroq } = await import("../../src/server/ai/groq-provider");
    await expect(completeWithGroq([{ role: "user", content: "hello" }], fetcher as typeof fetch))
      .rejects.toMatchObject({ code: "rate_limited", message: expect.not.stringContaining("test-secret") });
  });

  it("rejects oversized context before sending a request", async () => {
    Object.entries({ ...baseEnv, AI_ASSISTANT_ENABLED: "true", GROQ_API_KEY: "test-secret" })
      .forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn();
    const { completeWithGroq } = await import("../../src/server/ai/groq-provider");
    await expect(completeWithGroq(Array.from({ length: 9 }, () => ({
      role: "user" as const, content: "hello"
    })), fetcher as typeof fetch)).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
