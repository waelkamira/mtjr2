ALTER TABLE "AiAssistantSetting"
ADD CONSTRAINT "AiAssistantSetting_singleton_id_check"
CHECK ("id" = 'global');

ALTER TABLE "AiAssistantSetting"
ADD CONSTRAINT "AiAssistantSetting_maxCompletionTokens_check"
CHECK ("maxCompletionTokens" BETWEEN 128 AND 1200);
