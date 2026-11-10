import { timingSafeEqual } from "node:crypto";
import { generateAdInvoices } from "@/server/advertising/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function runInvoiceWorker(request: Request): Promise<Response> {
  // Missing configuration and invalid credentials both fail closed without disclosing worker state.
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const dueAt = new Date(periodEnd.getTime() + 14 * 24 * 60 * 60 * 1000);
  try { return Response.json(await generateAdInvoices({ periodStart, periodEnd, dueAt }), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Unable to generate advertising invoices." }, { status: 500 }); }
}


export async function GET(request: Request): Promise<Response> {
  return runInvoiceWorker(request);
}

export async function POST(request: Request): Promise<Response> {
  return runInvoiceWorker(request);
}
