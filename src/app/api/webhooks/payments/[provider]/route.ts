import { createHash } from "node:crypto";
import { getPaymentProvider } from "@/server/payments/providers/registry";
import { processVerifiedPaymentEvent } from "@/server/payments/payments";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { provider: providerKey } = await context.params;
  const provider = getPaymentProvider(providerKey);
  if (!provider) return Response.json({ error: "Payment provider is not configured." }, { status: 404 });

  try {
    const rawBody = await request.clone().text();
    const event = await provider.verifyWebhook(request);
    if (!event.eventId.trim() || !event.providerReference.trim()) {
      return Response.json({ error: "Invalid payment event." }, { status: 400 });
    }
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const result = await processVerifiedPaymentEvent({ providerKey, event, payloadHash });
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Payment webhook could not be verified or processed." }, { status: 400 });
  }
}
