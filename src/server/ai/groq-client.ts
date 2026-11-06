import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { getAiAssistantRuntimeSettings } from "@/server/ai/assistant-config";

const groqResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      role: z.string().optional(),
      content: z.string().nullable().optional(),
      tool_calls: z.array(z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({ name: z.string(), arguments: z.string() })
      })).optional()
    })
  })).min(1)
});

export type GroqMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

export async function groqChat(messages: GroqMessage[], tools?: unknown[]) {
  const settings = await getAiAssistantRuntimeSettings();
  if (!env.GROQ_API_KEY || !settings.enabled) {
    throw new Error("AI_ASSISTANT_DISABLED");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.2,
      max_completion_tokens: settings.maxCompletionTokens
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store"
  });

  if (response.status === 429) throw new Error("AI_RATE_LIMITED");
  if (response.status === 401 || response.status === 403) throw new Error("AI_PROVIDER_AUTH_ERROR");
  if (!response.ok) throw new Error("AI_PROVIDER_ERROR");

  const parsed = groqResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("AI_PROVIDER_INVALID_RESPONSE");
  return parsed.data.choices[0].message;
}
