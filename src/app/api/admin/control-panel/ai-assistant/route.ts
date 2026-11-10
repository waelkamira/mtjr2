import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import {
  AiAssistantSettingsError,
  getAiAssistantAdminSettings,
  updateAiAssistantAdminSettings
} from "@/server/admin/ai-assistant-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await getAiAssistantAdminSettings(), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: "Unable to load AI assistant settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const body: unknown = await request.json();
    return Response.json(await updateAiAssistantAdminSettings(body), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof AiAssistantSettingsError) {
      const message = error.code === "ENVIRONMENT_MASTER_SWITCH_DISABLED"
        ? "AI is locked off by the deployment environment."
        : "The Groq provider key is not configured.";
      return Response.json({ error: message, code: error.code }, { status: 409 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "Invalid AI assistant settings." }, { status: 400 });
    }
    return Response.json({ error: "Unable to update AI assistant settings." }, { status: 500 });
  }
}
