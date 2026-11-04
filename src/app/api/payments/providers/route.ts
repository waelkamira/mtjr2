import { listAvailablePaymentProviders } from "@/server/payments/payments";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json({ providers: await listAvailablePaymentProviders() }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }
  });
}
