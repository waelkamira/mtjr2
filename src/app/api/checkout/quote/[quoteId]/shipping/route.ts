import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { getCheckoutShippingOptions, selectCheckoutShipping } from "@/server/shipping/shipping";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ quoteId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json(await getCheckoutShippingOptions(token, quoteId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load shipping options.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json({ selection: await selectCheckoutShipping(token, quoteId, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to select shipping.";
    return Response.json({ error: message }, { status: /not active|no longer eligible/i.test(message) ? 409 : 400 });
  }
}
