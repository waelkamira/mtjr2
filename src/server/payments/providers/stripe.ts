import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { PaymentProviderConfigurationError } from "./types";
import type { PaymentProviderAdapter, ProviderRefundInput, ProviderRefundResult, VerifiedPaymentEvent } from "./types";

type StripeSession = {
  id: string;
  url: string | null;
  expires_at?: number;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string;
  metadata?: Record<string, string>;
};

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: StripeSession };
};

function requireStripeSecrets(credentials?: Record<string, string>) {
  if (credentials?.secretKey && credentials?.webhookSecret) return { secretKey: credentials.secretKey, webhookSecret: credentials.webhookSecret };
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new PaymentProviderConfigurationError("Stripe is not fully configured. Set server-side Stripe API and webhook credentials.");
  }
  return { secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET };
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) {
    throw new Error("Stripe signature header is malformed.");
  }
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) {
    throw new Error("Stripe webhook timestamp is outside the accepted tolerance.");
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!valid) throw new Error("Stripe webhook signature is invalid.");
}

async function createIntent(input: Parameters<PaymentProviderAdapter["createIntent"]>[0]) {
  const { secretKey } = requireStripeSecrets(input.providerCredentials);
  const currency = input.currencyCode.toLowerCase();
  if (!/^[a-z]{3}$/.test(currency) || !/^(0|[1-9]\d*)$/.test(input.amountMinor) || BigInt(input.amountMinor) <= BigInt("0") || BigInt(input.amountMinor) > BigInt("99999999")) {
    throw new Error("Stripe payment amount or currency is invalid.");
  }

  const successUrl = new URL(input.returnUrl);
  successUrl.searchParams.set("payment", "success");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const stripeSuccessUrl = successUrl.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
  const cancelUrl = new URL(input.returnUrl);
  cancelUrl.searchParams.set("payment", "cancelled");

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", stripeSuccessUrl);
  body.set("cancel_url", cancelUrl.toString());
  body.set("client_reference_id", input.paymentId);
  body.set("metadata[paymentId]", input.paymentId);
  body.set("metadata[orderId]", input.metadata.orderId ?? "");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", currency);
  body.set("line_items[0][price_data][unit_amount]", input.amountMinor);
  body.set("line_items[0][price_data][product_data][name]", `Matjar order ${input.orderNumber}`);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey
    },
    body,
    signal: AbortSignal.timeout(20_000)
  });
  const result = await response.json() as StripeSession & { error?: { message?: string } };
  if (!response.ok || !result.id || !result.url) {
    throw new Error("Stripe could not create a checkout session. Check provider configuration and retry.");
  }
  return {
    providerReference: result.id,
    checkoutUrl: result.url,
    expiresAt: result.expires_at ? new Date(result.expires_at * 1000) : null
  };
}

async function verifyWebhook(request: Request, credentials?: Record<string, string>): Promise<VerifiedPaymentEvent> {
  const { webhookSecret } = requireStripeSecrets(credentials);
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new Error("Stripe signature header is missing.");
  verifyStripeSignature(rawBody, signature, webhookSecret);

  const event = JSON.parse(rawBody) as StripeEvent;
  const session = event.data?.object;
  if (!event.id || !event.type || !session?.id) throw new Error("Stripe event payload is incomplete.");

  const eventType = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
    ? session.payment_status === "paid" ? "succeeded" : "processing"
    : event.type === "checkout.session.async_payment_failed" ? "failed"
    : event.type === "checkout.session.expired" ? "cancelled"
    : null;
  if (!eventType) throw new Error("Unsupported Stripe event type.");
  if (session.amount_total == null || !session.currency) throw new Error("Stripe checkout session has no final amount.");

  return {
    eventId: event.id,
    eventType,
    providerReference: session.id,
    amountMinor: String(session.amount_total),
    currencyCode: session.currency.toUpperCase(),
    occurredAt: new Date(event.created * 1000)
  };
}



export async function createStripeRefund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
  const { secretKey } = requireStripeSecrets(input.providerCredentials);
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(input.providerReference)) throw new Error("Stripe Checkout reference is invalid.");
  if (!/^(0|[1-9]\\d*)$/.test(input.amountMinor) || BigInt(input.amountMinor) <= 0n) throw new Error("Refund amount is invalid.");
  const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.providerReference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const session = await sessionResponse.json() as { id?: string; payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string | { id?: string } | null; client_reference_id?: string | null; metadata?: Record<string, string> };
  if (!sessionResponse.ok || session.id !== input.providerReference) throw new Error("Stripe could not verify the original Checkout payment.");
  if (session.payment_status !== "paid" || !session.payment_intent) throw new Error("Stripe Checkout payment has not been captured.");
  if (session.currency?.toUpperCase() !== input.currencyCode || session.amount_total == null || BigInt(input.amountMinor) > BigInt(session.amount_total)) {
    throw new Error("Refund amount or currency does not match the captured Stripe payment.");
  }
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
  if (!paymentIntent) throw new Error("Stripe payment intent reference is unavailable.");
  const body = new URLSearchParams();
  body.set("payment_intent", paymentIntent);
  body.set("amount", input.amountMinor);
  body.set("metadata[matjar_refund_id]", input.refundId);
  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const refund = await response.json() as { id?: string; status?: string; error?: { message?: string } };
  if (!response.ok || !refund.id) throw new Error("Stripe could not create the refund. Reconcile the provider dashboard before retrying.");
  return {
    providerRefundReference: refund.id,
    status: refund.status === "succeeded" ? "COMPLETED" : refund.status === "pending" ? "PROCESSING" : "FAILED"
  };
}

export async function getStripeRefundStatus(
  refundReference: string,
  credentials?: Record<string, string>
): Promise<ProviderRefundResult["status"]> {
  const { secretKey } = requireStripeSecrets(credentials);
  if (!/^re_[A-Za-z0-9]+$/.test(refundReference)) throw new Error("Stripe refund reference is invalid.");
  const response = await fetch(`https://api.stripe.com/v1/refunds/${encodeURIComponent(refundReference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const refund = await response.json() as { id?: string; status?: string };
  if (!response.ok || refund.id !== refundReference) throw new Error("Stripe refund status could not be retrieved.");
  return refund.status === "succeeded" ? "COMPLETED" : refund.status === "pending" ? "PROCESSING" : "FAILED";
}

export const stripePaymentProvider: PaymentProviderAdapter = {
  key: "stripe",
  displayName: "Stripe",
  createIntent,
  verifyWebhook,
  createRefund: createStripeRefund,
  getRefundStatus: getStripeRefundStatus
};
