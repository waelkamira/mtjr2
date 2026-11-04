import { createHash } from "node:crypto";
import { z } from "zod";
import { getPaymentProvider } from "@/server/payments/providers/registry";
import { processVerifiedPaymentEvent } from "@/server/payments/payments";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ provider: string }> };

const eventSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  eventType: z.enum(["succeeded", "processing", "failed", "cancelled"]),
  providerReference: z.string().trim().min(1).max(180),
  amountMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  occurredAt: z.date()
}).strict();

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { provider: providerKey } = await context.params;
  const provider = getPaymentProvider(providerKey);
  if (!provider) return Response.json({ error: "Payment provider is not configured." }, { status: 404 });

  // Invalid signatures and malformed provider events are permanent client errors.
  // Keep these separate from database/transaction failures, which providers must retry.
  let rawBody: string;
  let rawEvent: unknown;
  try {
    rawBody = await request.clone().text();
    rawEvent = await provider.verifyWebhook(request);
  } catch {
    return Response.json({ error: "Payment webhook verification failed." }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(rawEvent);
  if (!parsed.success) {
    return Response.json({ error: "Payment webhook payload is invalid." }, { status: 400 });
  }

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  try {
    const result = await processVerifiedPaymentEvent({ providerKey, event: parsed.data, payloadHash });
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/amount or currency does not match|reused an event ID with a different payload/i.test(message)) {
      return Response.json({ error: "Payment webhook conflicts with the recorded payment." }, {
        status: /reused an event ID/i.test(message) ? 409 : 400,
        headers: { "Cache-Control": "no-store" }
      });
    }

    // Unknown payment references may be a provider/database race; and unclassified
    // failures can be transient. Return 5xx so the provider retries instead of
    // permanently dropping a valid success event.
    return Response.json({ error: "Payment webhook processing failed; retry delivery." }, {
      status: 500,
      headers: { "Cache-Control": "no-store", "Retry-After": "30" }
    });
  }
}
