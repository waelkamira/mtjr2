import "server-only";

import { env, isAiAssistantEnabled } from "@/lib/env";

const endpoint = "https://api.groq.com/openai/v1/chat/completions";

export type GroqChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type GroqFailureCode = "disabled" | "unauthorized" | "rate_limited" | "timeout" | "unavailable" | "invalid_response";

export class GroqProviderError extends Error {
  constructor(message: string, readonly code: GroqFailureCode) {
    super(message);
    this.name = "GroqProviderError";
  }
}

export async function completeWithGroq(
  messages: GroqChatMessage[],
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (!isAiAssistantEnabled(env)) {
    throw new GroqProviderError("The AI assistant is not enabled.", "disabled");
  }
  if (messages.length < 1 || messages.length > 8 || messages.some((message) => message.content.length > 7000)) {
    throw new GroqProviderError("The conversation context is outside the allowed limit.", "invalid_response");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages,
        max_tokens: 700,
        temperature: 0.2,
        stream: false
      }),
      cache: "no-store",
      signal: controller.signal
    });

    if (response.status === 401 || response.status === 403) {
      throw new GroqProviderError("The AI provider rejected its server credentials.", "unauthorized");
    }
    if (response.status === 429) {
      throw new GroqProviderError("The AI provider quota is temporarily unavailable.", "rate_limited");
    }
    if (!response.ok) {
      throw new GroqProviderError("The AI provider is temporarily unavailable.", "unavailable");
    }

    let payload: { choices?: Array<{ message?: { content?: string | null } }> };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new GroqProviderError("The AI provider returned an invalid response.", "invalid_response");
    }
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new GroqProviderError("The AI provider returned an empty response.", "invalid_response");
    }
    return content.trim();
  } catch (error) {
    if (error instanceof GroqProviderError) throw error;
    if (controller.signal.aborted) throw new GroqProviderError("The AI provider request timed out.", "timeout");
    throw new GroqProviderError("The AI provider is temporarily unavailable.", "unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
