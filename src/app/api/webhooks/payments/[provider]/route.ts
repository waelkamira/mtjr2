import { createHash } from "node:crypto";
import { z } from "zod";
import { getPaymentProvider } from "@/server/payments/providers/registry";
import { processVerifiedPaymentEvent } from "@/server/payments/payments";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ provider: string }> };

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

async function readBoundedWebhookBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\\d+$/.test(declaredLength) || Number(declaredLength) > MAX_WEBHOOK_BODY_BYTES) {
      throw new Error("Webhook body exceeds the configured size limit.");
    }
  }
  if (!request.body) throw new Error("Webhook body is missing.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Webhook body exceeds the configured size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

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
  let rawBody: Uint8Array;
  let rawEvent: unknown;
  try {
    rawBody = await readBoundedWebhookBody(request);
    // Pass a fresh request containing the already bounded raw bytes so provider
    // signature verification sees the exact payload without buffering it twice.
    const verificationRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: rawBody
    });
    rawEvent = await provider.verifyWebhook(verificationRequest);
  } catch {
    return Response.json({ error: "Payment webhook verification failed or payload exceeded the size limit." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" }
    });
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
