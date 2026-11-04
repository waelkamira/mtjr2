import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { placeOrderFromCheckoutQuote } from "@/server/orders/orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ quoteId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    const order = await placeOrderFromCheckoutQuote(token, quoteId);
    return Response.json({ order }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to place this order.";
    const status = /expired|no longer active|stock|reservation|already placed/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
