ALTER TABLE "AiAssistantSetting"
ADD CONSTRAINT "AiAssistantSetting_model_allowlist_check"
CHECK ("model" = 'openai/gpt-oss-20b');
