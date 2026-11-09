import "server-only";

import type { PaymentProviderAdapter, VerifiedPaymentEvent } from "./types";

type PayPalLinks = { rel?: string; href?: string };
type PayPalAmount = { currency_code?: string; value?: string };
type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: PayPalAmount;
  create_time?: string;
};
type PayPalOrder = {
  id?: string;
  status?: string;
  links?: PayPalLinks[];
  purchase_units?: Array<{
    payments?: { captures?: PayPalCapture[] };
  }>;
};
type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: PayPalAmount;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

function configuration() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const mode = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
  if (!clientId || !clientSecret || !webhookId) {
    throw new Error("PayPal is not fully configured. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID.");
  }
  return {
    clientId,
    clientSecret,
    webhookId,
    baseUrl: mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"
  };
}

async function accessToken() {
  const config = configuration();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json() as { access_token?: string };
  if (!response.ok || !result.access_token) {
    throw new Error("PayPal authentication failed. Check the server-side API credentials and mode.");
  }
  return { token: result.access_token, config };
}

async function paypalRequest<T>(
  path: string,
  init: RequestInit = {},
  requestId?: string
): Promise<T> {
  const { token, config } = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  if (requestId) headers.set("PayPal-Request-Id", requestId);
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const result = await response.json().catch(() => null) as (T & { name?: string }) | null;
  if (!response.ok || !result) {
    throw new Error(`PayPal request failed (${response.status}). Check the provider configuration and transaction status.`);
  }
  return result;
}

function currencyDigits(currencyCode: string) {
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("PayPal currency code is invalid.");
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    throw new Error("PayPal currency code is not supported by the runtime.");
  }
}

function minorToMajor(amountMinor: string, currencyCode: string) {
  if (!/^(0|[1-9]\d*)$/.test(amountMinor)) throw new Error("PayPal amount is invalid.");
  const digits = currencyDigits(currencyCode);
  const scale = 10n ** BigInt(digits);
  const amount = BigInt(amountMinor);
  const whole = amount / scale;
  if (digits === 0) return whole.toString();
  const fraction = (amount % scale).toString().padStart(digits, "0");
  return `${whole.toString()}.${fraction}`;
}

function majorToMinor(value: string, currencyCode: string) {
  if (!/^(0|[1-9]\d*)(?:\.(\d+))?$/.test(value)) throw new Error("PayPal returned an invalid transaction amount.");
  const digits = currencyDigits(currencyCode);
  const [, whole, fraction = ""] = value.match(/^(0|[1-9]\d*)(?:\.(\d+))?$/)!;
  if (fraction.length > digits) throw new Error("PayPal returned an amount with unsupported currency precision.");
  return (BigInt(whole) * (10n ** BigInt(digits)) + BigInt((fraction + "0".repeat(digits)).slice(0, digits) || "0")).toString();
}

function captureFromOrder(order: PayPalOrder): PayPalCapture {
  const captures = order.purchase_units?.flatMap((unit) => unit.payments?.captures ?? []) ?? [];
  if (captures.length !== 1 || !captures[0].id || !captures[0].amount?.currency_code || !captures[0].amount.value) {
    throw new Error("PayPal did not return exactly one complete capture for this order.");
  }
  return captures[0];
}

async function createIntent(input: Parameters<PaymentProviderAdapter["createIntent"]>[0]) {
  const origin = new URL(input.returnUrl).origin;
  const callback = new URL("/api/payments/paypal/return", origin);
  const cancelUrl = new URL(input.returnUrl);
  cancelUrl.searchParams.set("payment", "cancelled");

  const order = await paypalRequest<PayPalOrder>(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: input.paymentId,
          custom_id: input.paymentId,
          invoice_id: input.paymentId,
          description: `Matjar order ${input.orderNumber}`,
          amount: {
            currency_code: input.currencyCode,
            value: minorToMajor(input.amountMinor, input.currencyCode)
          }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Matjar",
              user_action: "PAY_NOW",
              return_url: callback.toString(),
              cancel_url: cancelUrl.toString()
            }
          }
        }
      })
    },
    input.idempotencyKey
  );

  if (!order.id) throw new Error("PayPal did not return an order reference.");
  const approval = order.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
  if (!approval) throw new Error("PayPal did not return a buyer approval link.");
  const approvalUrl = new URL(approval);
  if (approvalUrl.protocol !== "https:" || !["www.paypal.com", "www.sandbox.paypal.com"].includes(approvalUrl.hostname)) {
    throw new Error("PayPal returned an unexpected approval URL.");
  }
  return { providerReference: order.id, checkoutUrl: approvalUrl.toString(), expiresAt: null };
}

export async function captureApprovedPayPalOrder(orderId: string, paymentId: string): Promise<VerifiedPaymentEvent> {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(orderId)) throw new Error("PayPal order reference is invalid.");
  let order: PayPalOrder;
  try {
    order = await paypalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      { method: "POST", body: "{}" },
      `${paymentId}-capture`
    );
  } catch {
    // A repeated return may arrive after PayPal has already captured the order.
    // Retrieve the canonical order and accept it only if a completed capture exists.
    order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  }

  const capture = captureFromOrder(order);
  const currencyCode = capture.amount!.currency_code!.toUpperCase();
  const status = capture.status?.toUpperCase();
  const eventType: VerifiedPaymentEvent["eventType"] =
    status === "COMPLETED" ? "succeeded" :
    status === "PENDING" ? "processing" :
    status === "DECLINED" || status === "FAILED" ? "failed" :
    (() => { throw new Error("PayPal capture is not in a final or recognized state."); })();

  return {
    eventId: capture.id!,
    eventType,
    providerReference: orderId,
    amountMinor: majorToMinor(capture.amount!.value!, currencyCode),
    currencyCode,
    occurredAt: capture.create_time ? new Date(capture.create_time) : new Date()
  };
}

async function verifyWebhook(request: Request): Promise<VerifiedPaymentEvent> {
  const rawBody = await request.text();
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    throw new Error("PayPal webhook body is not valid JSON.");
  }
  const config = configuration();
  const requiredHeaders = {
    auth_algo: request.headers.get("paypal-auth-algo"),
    cert_url: request.headers.get("paypal-cert-url"),
    transmission_id: request.headers.get("paypal-transmission-id"),
    transmission_sig: request.headers.get("paypal-transmission-sig"),
    transmission_time: request.headers.get("paypal-transmission-time")
  };
  if (Object.values(requiredHeaders).some((value) => !value) || !event.id || !event.event_type || !event.resource) {
    throw new Error("PayPal webhook headers or event payload are incomplete.");
  }

  const verification = await paypalRequest<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        ...requiredHeaders,
        webhook_id: config.webhookId,
        webhook_event: event
      })
    }
  );
  if (verification.verification_status !== "SUCCESS") {
    throw new Error("PayPal webhook signature verification failed.");
  }

  const resource = event.resource;
  const orderId = resource.supplementary_data?.related_ids?.order_id;
  if (!orderId || !resource.amount?.currency_code || !resource.amount.value) {
    throw new Error("PayPal capture event is missing its order or amount reference.");
  }
  const eventType: VerifiedPaymentEvent["eventType"] =
    event.event_type === "PAYMENT.CAPTURE.COMPLETED" ? "succeeded" :
    event.event_type === "PAYMENT.CAPTURE.PENDING" ? "processing" :
    event.event_type === "PAYMENT.CAPTURE.DENIED" ? "failed" :
    (() => { throw new Error("Unsupported PayPal webhook event type."); })();
  const currencyCode = resource.amount.currency_code.toUpperCase();

  return {
    eventId: event.id,
    eventType,
    providerReference: orderId,
    amountMinor: majorToMinor(resource.amount.value, currencyCode),
    currencyCode,
    occurredAt: event.create_time ? new Date(event.create_time) : new Date()
  };
}

export const paypalPaymentProvider: PaymentProviderAdapter = {
  key: "paypal",
  displayName: "PayPal",
  createIntent,
  verifyWebhook
};
