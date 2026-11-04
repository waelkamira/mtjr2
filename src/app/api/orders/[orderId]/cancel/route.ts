import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { cancelOwnedOrder } from "@/server/orders/orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { orderId } = await context.params;
    const result = await cancelOwnedOrder(await getOrCreateGuestCartToken(), orderId);
    return Response.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order could not be canceled.";
    const status = /not found/i.test(message) ? 404
      : /payment attempt|only orders|no longer eligible|changed concurrently|status changed while/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
