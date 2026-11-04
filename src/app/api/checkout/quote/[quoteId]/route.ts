import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { getCheckoutQuote } from "@/server/checkout/quotes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ quoteId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json({ quote: await getCheckoutQuote(token, quoteId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Checkout quote not found.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
