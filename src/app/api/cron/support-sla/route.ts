import { timingSafeEqual } from "node:crypto";
import { processSupportSlaEscalations } from "@/server/support/sla";

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
  if (!process.env.CRON_SECRET) return Response.json({ error: "SLA worker is not configured." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return Response.json(await processSupportSlaEscalations(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to process support SLA queue." }, { status: 500 });
  }
}
