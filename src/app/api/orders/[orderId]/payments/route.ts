import { z } from "zod";
import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { startOrderPayment } from "@/server/payments/payments";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderId: string }> };
const bodySchema = z.object({
  provider: z.string().trim().min(2).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/),
  idempotencyKey: z.string().uuid()
}).strict();

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const body = bodySchema.parse(await request.json());
    const { orderId } = await context.params;
    const payment = await startOrderPayment({
      guestToken: await getOrCreateGuestCartToken(), orderId,
      providerKey: body.provider, idempotencyKey: body.idempotencyKey
    });
    return Response.json({ payment }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start payment.";
    const status = /not found/i.test(message) ? 404
      : /not configured/i.test(message) ? 503
      : /already used|not awaiting payment|zero-value/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
