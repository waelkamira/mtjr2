import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createCheckoutQuote } from "@/server/checkout/quotes";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const token = await getOrCreateGuestCartToken();
    return Response.json({ quote: await createCheckoutQuote(token, body) }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to create a checkout quote.";
    const status = /stock|purchasable|cart is empty|expired|already been used|coupon has reached/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
