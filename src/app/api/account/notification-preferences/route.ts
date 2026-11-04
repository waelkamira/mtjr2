import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { getMyNotificationPreferences, updateMyNotificationPreferences } from "@/server/notifications/notifications";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ preferences: await getMyNotificationPreferences() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notification preferences.";
    return Response.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 400 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const preferences = await updateMyNotificationPreferences(body);
    return Response.json({ preferences }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Invalid notification preferences." : error instanceof Error ? error.message : "Unable to save notification preferences.";
    return Response.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 400 });
  }
}
