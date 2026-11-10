import { timingSafeEqual } from "node:crypto";
import { processNotificationDeliveries } from "@/server/notifications/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request): Promise<Response> {
  // Missing configuration and invalid credentials both fail closed without disclosing worker state.
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return Response.json(await processNotificationDeliveries(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to process notification delivery queue." }, { status: 500 });
  }
}
