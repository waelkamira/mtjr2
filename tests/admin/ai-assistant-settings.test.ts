import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    aiAssistantSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() }
  };
  return {
    env: {
      AI_ASSISTANT_ENABLED: "false" as string,
      GROQ_API_KEY: undefined as string | undefined,
      GROQ_MODEL: "openai/gpt-oss-20b"
    },
    requirePlatformManagement: vi.fn(),
    prisma: {
      aiAssistantSetting: { findUnique: vi.fn() },
      $transaction: vi.fn()
    },
    tx
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePlatformManagement: mocks.requirePlatformManagement
}));

import {
  AiAssistantSettingsError,
  getAiAssistantAdminSettings,
  updateAiAssistantAdminSettings
} from "@/server/admin/ai-assistant-settings";
import { getAiAssistantRuntimeSettings } from "@/server/ai/assistant-config";

describe("Super Admin AI assistant settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.AI_ASSISTANT_ENABLED = "false";
    mocks.env.GROQ_API_KEY = undefined;
    mocks.env.GROQ_MODEL = "openai/gpt-oss-20b";
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "admin-1" });
    mocks.prisma.aiAssistantSetting.findUnique.mockResolvedValue({
      enabled: false, model: "openai/gpt-oss-20b", maxCompletionTokens: 900
    });
    mocks.tx.aiAssistantSetting.findUnique.mockResolvedValue({
      enabled: false, model: "openai/gpt-oss-20b", maxCompletionTokens: 900
    });
    mocks.tx.aiAssistantSetting.upsert.mockResolvedValue({
      enabled: true, model: "openai/gpt-oss-20b", maxCompletionTokens: 900, updatedAt: new Date("2026-11-06T12:00:00.000Z")
    });
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.prisma.$transaction.mockImplementation((callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("returns only safe provider status and never returns the API key", async () => {
    mocks.env.GROQ_API_KEY = "server-secret-test-value";
    const settings = await getAiAssistantAdminSettings();

    expect(settings).toMatchObject({
      enabled: false,
      environmentEnabled: false,
      providerKeyConfigured: true,
      effectiveEnabled: false
    });
    expect(settings).not.toHaveProperty("GROQ_API_KEY");
    expect(JSON.stringify(settings)).not.toContain("server-secret-test-value");
  });

  it("cannot enable AI while the deployment master switch is off", async () => {
    await expect(updateAiAssistantAdminSettings({
      enabled: true, model: "openai/gpt-oss-20b", maxCompletionTokens: 900
    })).rejects.toMatchObject({ code: "ENVIRONMENT_MASTER_SWITCH_DISABLED" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("cannot enable AI without a provider key", async () => {
    mocks.env.AI_ASSISTANT_ENABLED = "true";
    await expect(updateAiAssistantAdminSettings({
      enabled: true, model: "openai/gpt-oss-20b", maxCompletionTokens: 900
    })).rejects.toBeInstanceOf(AiAssistantSettingsError);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates the singleton and writes a safe audit event atomically", async () => {
    mocks.env.AI_ASSISTANT_ENABLED = "true";
    mocks.env.GROQ_API_KEY = "server-secret-test-value";
    const settings = await updateAiAssistantAdminSettings({
      enabled: true, model: "openai/gpt-oss-20b", maxCompletionTokens: 900
    });

    expect(settings.effectiveEnabled).toBe(true);
    expect(settings.providerKeyConfigured).toBe(true);
    expect(JSON.stringify(settings)).not.toContain("server-secret-test-value");
    expect(mocks.tx.aiAssistantSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "global" },
      create: expect.objectContaining({ id: "global", enabled: true }),
      update: expect.objectContaining({ enabled: true })
    }));
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: "admin-1",
        action: "ai.assistant.settings_updated",
        resourceId: "global"
      })
    }));
  });

  it("rejects token limits outside the bounded range", async () => {
    await expect(updateAiAssistantAdminSettings({
      enabled: false, model: "openai/gpt-oss-20b", maxCompletionTokens: 9999
    })).rejects.toThrow();
  });
});

describe("AI assistant runtime policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.AI_ASSISTANT_ENABLED = "true";
    mocks.env.GROQ_API_KEY = "server-secret-test-value";
    mocks.env.GROQ_MODEL = "openai/gpt-oss-20b";
  });

  it("fails closed when the settings database cannot be read", async () => {
    mocks.prisma.aiAssistantSetting.findUnique.mockRejectedValue(new Error("database unavailable"));
    await expect(getAiAssistantRuntimeSettings()).resolves.toEqual({
      enabled: false, model: "openai/gpt-oss-20b", maxCompletionTokens: 900
    });
  });

  it("keeps the environment master switch authoritative", async () => {
    mocks.env.AI_ASSISTANT_ENABLED = "false";
    await expect(getAiAssistantRuntimeSettings()).resolves.toMatchObject({ enabled: false });
    expect(mocks.prisma.aiAssistantSetting.findUnique).not.toHaveBeenCalled();
  });
});
