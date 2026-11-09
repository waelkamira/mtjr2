import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { captureApprovedPayPalOrder } from "@/server/payments/providers/paypal";
import { getPaymentProviderRuntimeSnapshot } from "@/server/admin/payment-providers";
import { processVerifiedPaymentEvent } from "@/server/payments/payments";

export const runtime = "nodejs";

function orderRedirect(orderId: string | null, state: string) {
  const path = orderId
    ? `/orders/${encodeURIComponent(orderId)}`
    : "/orders";
  const destination = new URL(path, env.APP_URL);
  destination.searchParams.set("payment", state);
  return Response.redirect(destination, 303);
}

export async function GET(request: Request): Promise<Response> {
  const orderId = new URL(request.url).searchParams.get("token");
  if (!orderId || orderId.length > 80) return orderRedirect(null, "pending");

  const payment = await prisma.payment.findUnique({
    where: { provider_providerReference: { provider: "paypal", providerReference: orderId } },
    select: { id: true, orderId: true }
  });
  if (!payment) return orderRedirect(null, "pending");

  try {
    const snapshot = await getPaymentProviderRuntimeSnapshot(payment.id);
    const event = await captureApprovedPayPalOrder(
      orderId,
      payment.id,
      snapshot?.credentials,
      snapshot?.environment
    );
    const payloadHash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
    const result = await processVerifiedPaymentEvent({
      providerKey: "paypal",
      event,
      payloadHash
    });
    const resultStatus = "status" in result ? result.status : null;
    const state = resultStatus === "SUCCEEDED" ? "success" :
      resultStatus === "FAILED" ? "failed" : "pending";
    return orderRedirect(payment.orderId, state);
  } catch {
    // A timeout is not proof of a failed payment. The verified webhook remains
    // the recovery path, so the customer is shown a neutral pending state.
    return orderRedirect(payment.orderId, "pending");
  }
}
