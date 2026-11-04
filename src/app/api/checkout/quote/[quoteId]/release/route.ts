import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { releaseCheckoutQuote } from "@/server/checkout/quotes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ quoteId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json(await releaseCheckoutQuote(token, quoteId));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to release this quote.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
