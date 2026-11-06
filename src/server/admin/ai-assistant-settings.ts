import "server-only";

import { AuditActorType } from "@prisma/client";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";

const SETTING_ID = "global";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const updateSchema = z.object({
  enabled: z.boolean(),
  model: z.literal(DEFAULT_MODEL),
  maxCompletionTokens: z.number().int().min(128).max(1200)
}).strict();

export class AiAssistantSettingsError extends Error {
  constructor(readonly code: "ENVIRONMENT_MASTER_SWITCH_DISABLED" | "PROVIDER_KEY_MISSING") {
    super(code);
    this.name = "AiAssistantSettingsError";
  }
}

function publicSettings(setting: {
  enabled: boolean;
  model: string;
  maxCompletionTokens: number;
} | null) {
  const environmentEnabled = env.AI_ASSISTANT_ENABLED === "true";
  const providerKeyConfigured = Boolean(env.GROQ_API_KEY);
  const enabled = setting?.enabled ?? false;
  return {
    enabled,
    model: setting?.model ?? env.GROQ_MODEL ?? DEFAULT_MODEL,
    maxCompletionTokens: setting?.maxCompletionTokens ?? 900,
    environmentEnabled,
    providerKeyConfigured,
    effectiveEnabled: enabled && environmentEnabled && providerKeyConfigured
  };
}

/** Super Admin-only settings read. Provider credentials are never returned. */
export async function getAiAssistantAdminSettings() {
  await requirePlatformManagement();
  const setting = await prisma.aiAssistantSetting.findUnique({
    where: { id: SETTING_ID },
    select: { enabled: true, model: true, maxCompletionTokens: true }
  });
  return publicSettings(setting);
}

/** Update the singleton runtime policy and record the old/new safe values atomically. */
export async function updateAiAssistantAdminSettings(input: unknown) {
  const actor = await requirePlatformManagement();
  const parsed = updateSchema.parse(input);

  if (parsed.enabled && env.AI_ASSISTANT_ENABLED !== "true") {
    throw new AiAssistantSettingsError("ENVIRONMENT_MASTER_SWITCH_DISABLED");
  }
  if (parsed.enabled && !env.GROQ_API_KEY) {
    throw new AiAssistantSettingsError("PROVIDER_KEY_MISSING");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const previous = await tx.aiAssistantSetting.findUnique({
      where: { id: SETTING_ID },
      select: { enabled: true, model: true, maxCompletionTokens: true }
    });
    const updated = await tx.aiAssistantSetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID, ...parsed },
      update: parsed,
      select: { enabled: true, model: true, maxCompletionTokens: true, updatedAt: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "ai.assistant.settings_updated",
        resource: "ai_assistant_setting",
        resourceId: SETTING_ID,
        scopeType: "GLOBAL",
        scopeId: "GLOBAL",
        occurredAt: now,
        metadata: {
          previous: previous ?? { enabled: false, model: DEFAULT_MODEL, maxCompletionTokens: 900 },
          next: parsed
        }
      }
    });
    return { ...publicSettings(updated), updatedAt: updated.updatedAt.toISOString() };
  });
}
