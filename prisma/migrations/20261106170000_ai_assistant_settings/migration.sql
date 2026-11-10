CREATE TABLE "AiAssistantSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "model" VARCHAR(120) NOT NULL DEFAULT 'openai/gpt-oss-20b',
    "maxCompletionTokens" INTEGER NOT NULL DEFAULT 900,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAssistantSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AiAssistantSetting" ("id", "enabled", "model", "maxCompletionTokens", "updatedAt")
VALUES ('global', false, 'openai/gpt-oss-20b', 900, CURRENT_TIMESTAMP);
