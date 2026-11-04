import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { markMyNotificationRead } from "@/server/notifications/notifications";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ notificationId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { notificationId } = await context.params;
    return Response.json({ notification: await markMyNotificationRead(notificationId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notification.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
