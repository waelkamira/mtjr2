import { createHash } from "node:crypto";
import { z } from "zod";
import { getPaymentProviderAdapter } from "@/server/payments/providers/registry";
import { getPaymentProviderRuntimeSnapshot, getActiveProviderCredentialsForWebhook, getPaymentProviderRuntimeEnvironment } from "@/server/admin/payment-providers";
import { prisma } from "@/lib/db/prisma";
import { processVerifiedPaymentEvent } from "@/server/payments/payments";
import { PaymentProviderConfigurationError, PaymentProviderUnavailableError } from "@/server/payments/providers/types";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ provider: string }> };

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

async function readBoundedWebhookBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_WEBHOOK_BODY_BYTES) {
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
  const provider = getPaymentProviderAdapter(providerKey);
  if (!provider) return Response.json({ error: "Payment provider is not configured." }, { status: 404 });

  // Invalid payload/signature failures are permanent; database/provider outages must be retried.
  let rawBody: Uint8Array;
  try {
    rawBody = await readBoundedWebhookBody(request);
  } catch {
    return Response.json({ error: "Webhook body is invalid or exceeds the size limit." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" }
    });
  }

  let payload: {
    data?: { object?: { id?: string; metadata?: { paymentId?: string } } };
    resource?: { custom_id?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
  };
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return Response.json({ error: "Webhook payload is not valid JSON." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const paymentReference = providerKey === "stripe"
    ? payload.data?.object?.id
    : payload.resource?.supplementary_data?.related_ids?.order_id;
  const paymentId = providerKey === "stripe"
    ? payload.data?.object?.metadata?.paymentId
    : payload.resource?.custom_id;
  if (!paymentReference) {
    return Response.json({ error: "Webhook payment reference is missing." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" }
    });
  }

  let snapshot: Awaited<ReturnType<typeof getPaymentProviderRuntimeSnapshot>> = null;
  let managedFallbackCredentials: Record<string, string> | null = null;
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        provider: providerKey,
        OR: [
          { providerReference: paymentReference },
          ...(paymentId ? [{ id: paymentId }] : [])
        ]
      },
      select: { id: true }
    });
    snapshot = payment ? await getPaymentProviderRuntimeSnapshot(payment.id) : null;
    const environment = getPaymentProviderRuntimeEnvironment();
    managedFallbackCredentials = !payment
      ? await getActiveProviderCredentialsForWebhook(providerKey as "stripe" | "paypal", environment)
      : null;
  } catch {
    return Response.json({ error: "Payment webhook verification is temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" }
    });
  }

  const environment = getPaymentProviderRuntimeEnvironment();
  const fallbackCredentials = snapshot?.credentials ?? managedFallbackCredentials ?? undefined;
  // Legacy payments without snapshots retain the legacy provider environment configuration.
  const verificationEnvironment = snapshot?.environment ?? (managedFallbackCredentials ? environment : undefined);
  const verificationRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: rawBody
  });
  let rawEvent: unknown;
  try {
    rawEvent = await provider.verifyWebhook(verificationRequest, fallbackCredentials, verificationEnvironment);
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError || error instanceof PaymentProviderConfigurationError) {
      return Response.json({ error: "Payment provider verification is temporarily unavailable." }, {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" }
      });
    }
    return Response.json({ error: "Payment webhook signature or payload verification failed." }, {
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
