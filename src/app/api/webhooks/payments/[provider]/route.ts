import { createHash } from "node:crypto";
import { z } from "zod";
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
    const rawEvent = await provider.verifyWebhook(request);
    const event = z.object({
      eventId: z.string().trim().min(1).max(200),
      eventType: z.enum(["succeeded", "processing", "failed", "cancelled"]),
      providerReference: z.string().trim().min(1).max(180),
      amountMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
      currencyCode: z.string().regex(/^[A-Z]{3}$/),
      occurredAt: z.date()
    }).strict().parse(rawEvent);
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const result = await processVerifiedPaymentEvent({ providerKey, event, payloadHash });
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Payment webhook could not be verified or processed." }, { status: 400 });
  }
}
