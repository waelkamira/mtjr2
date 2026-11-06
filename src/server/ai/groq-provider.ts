import "server-only";

import { env, isAiAssistantEnabled } from "@/lib/env";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class GroqProviderError extends Error {
  constructor(
    message: string,
    readonly code: "disabled" | "unauthorized" | "rate_limited" | "timeout" | "unavailable" | "invalid_response"
  ) {
    super(message);
    this.name = "GroqProviderError";
  }
}

type GroqCompletionInput = {
  messages: GroqMessage[];
  maxTokens?: number;
  temperature?: number;
};

type GroqCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function createGroqCompletion(
  input: GroqCompletionInput,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (!isAiAssistantEnabled(env)) {
    throw new GroqProviderError("The AI assistant is not enabled.", "disabled");
  }

  if (input.messages.length < 1 || input.messages.length > 12) {
    throw new GroqProviderError("The conversation context is outside the allowed limit.", "invalid_response");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetcher(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: input.messages,
        max_tokens: Math.min(Math.max(input.maxTokens ?? 600, 1), 900),
        temperature: Math.min(Math.max(input.temperature ?? 0.2, 0), 1),
        stream: false
      }),
      signal: controller.signal,
      cache: "no-store"
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

    let payload: GroqCompletionResponse;
    try {
      payload = await response.json() as GroqCompletionResponse;
    } catch {
      throw new GroqProviderError("The AI provider returned an invalid response.", "invalid_response");
    }

    const answer = payload.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      throw new GroqProviderError("The AI provider returned an empty response.", "invalid_response");
    }
    return answer.trim();
  } catch (error) {
    if (error instanceof GroqProviderError) throw error;
    if (controller.signal.aborted) {
      throw new GroqProviderError("The AI provider request timed out.", "timeout");
    }
    throw new GroqProviderError("The AI provider is temporarily unavailable.", "unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
