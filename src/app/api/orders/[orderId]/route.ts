import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { getOwnedOrder } from "@/server/orders/orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { orderId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json({ order: await getOwnedOrder(token, orderId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Order not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}
