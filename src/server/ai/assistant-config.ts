import "server-only";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

export type AiAssistantRuntimeSettings = {
  enabled: boolean;
  model: string;
  maxCompletionTokens: number;
};

/**
 * Resolve the effective server policy. The deployment environment is a hard
 * kill switch; a database setting can never enable AI when it is off or when
 * the provider key is missing. Any database read failure fails closed.
 */
export async function getAiAssistantRuntimeSettings(): Promise<AiAssistantRuntimeSettings> {
  const model = env.GROQ_MODEL || DEFAULT_MODEL;
  if (env.AI_ASSISTANT_ENABLED !== "true" || !env.GROQ_API_KEY) {
    return { enabled: false, model, maxCompletionTokens: 900 };
  }

  try {
    const setting = await prisma.aiAssistantSetting.findUnique({
      where: { id: "global" },
      select: { enabled: true, model: true, maxCompletionTokens: true }
    });
    if (setting && setting.model !== DEFAULT_MODEL) {
      return { enabled: false, model: DEFAULT_MODEL, maxCompletionTokens: 900 };
    }
    return {
      enabled: setting?.enabled === true,
      model: DEFAULT_MODEL,
      maxCompletionTokens: setting?.maxCompletionTokens ?? 900
    };
  } catch {
    return { enabled: false, model, maxCompletionTokens: 900 };
  }
}
