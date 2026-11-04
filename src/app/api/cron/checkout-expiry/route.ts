import { env } from "@/lib/env";
import { expireDueCheckoutQuotes } from "@/server/checkout/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "Reservation cleanup is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await expireDueCheckoutQuotes();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Reservation cleanup failed." }, { status: 500 });
  }
}
