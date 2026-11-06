import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { reorderOwnedOrder } from "@/server/orders/orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { orderId } = await context.params;
    const cart = await reorderOwnedOrder(await getOrCreateGuestCartToken(), orderId);
    return Response.json({ cart }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order items could not be added to your cart.";
    const status = /not found/i.test(message) ? 404
      : /unavailable|not enough|maximum/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
