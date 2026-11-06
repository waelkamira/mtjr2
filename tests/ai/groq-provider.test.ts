import { afterEach, describe, expect, it, vi } from "vitest";

const requiredEnvironment = {
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

  it("does not call the provider while the assistant is disabled", async () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "false");
    Object.entries(requiredEnvironment).forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn();
    const { createGroqCompletion, GroqProviderError } = await import("../../src/server/ai/groq-provider");

    await expect(createGroqCompletion({ messages: [{ role: "user", content: "hello" }] }, fetcher as typeof fetch))
      .rejects.toMatchObject({ code: "disabled" } satisfies Partial<GroqProviderError>);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the server secret and returns the provider's assistant text", async () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("GROQ_API_KEY", "test-groq-secret");
    vi.stubEnv("GROQ_MODEL", "test-model");
    Object.entries(requiredEnvironment).forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content: "  Hello from Groq  " } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const { createGroqCompletion } = await import("../../src/server/ai/groq-provider");

    await expect(createGroqCompletion({ messages: [{ role: "user", content: "hello" }] }, fetcher as typeof fetch))
      .resolves.toBe("Hello from Groq");
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer test-groq-secret");
    expect(JSON.stringify(request.body)).not.toContain("test-groq-secret");
  });

  it("maps provider quota exhaustion to a safe rate-limited error", async () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("GROQ_API_KEY", "test-groq-secret");
    Object.entries(requiredEnvironment).forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    const { createGroqCompletion } = await import("../../src/server/ai/groq-provider");

    await expect(createGroqCompletion({ messages: [{ role: "user", content: "hello" }] }, fetcher as typeof fetch))
      .rejects.toMatchObject({ code: "rate_limited", message: expect.not.stringContaining("test-groq-secret") });
  });

  it("rejects oversized conversation context before making a request", async () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("GROQ_API_KEY", "test-groq-secret");
    Object.entries(requiredEnvironment).forEach(([key, value]) => vi.stubEnv(key, value));
    const fetcher = vi.fn();
    const { createGroqCompletion } = await import("../../src/server/ai/groq-provider");

    await expect(createGroqCompletion({
      messages: Array.from({ length: 13 }, () => ({ role: "user" as const, content: "hello" }))
    }, fetcher as typeof fetch)).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
