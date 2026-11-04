import { listMyNotifications } from "@/server/notifications/notifications";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listMyNotifications(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notifications.";
    return Response.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 400 });
  }
}
