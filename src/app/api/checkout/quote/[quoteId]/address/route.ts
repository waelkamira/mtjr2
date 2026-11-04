import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { getCheckoutAddressOptions, setCheckoutDeliveryAddress } from "@/server/checkout/delivery-address";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ quoteId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json(await getCheckoutAddressOptions(token, quoteId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to load delivery address options.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json({ address: await setCheckoutDeliveryAddress(token, quoteId, body) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to save delivery address.";
    return Response.json({ error: message }, { status: /not active|expired|unavailable/i.test(message) ? 409 : 400 });
  }
}
