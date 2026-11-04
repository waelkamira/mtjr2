import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { calculateCheckoutTax } from "@/server/tax/tax";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ quoteId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { quoteId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json({ tax: await calculateCheckoutTax(token, quoteId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate checkout tax.";
    return Response.json({ error: message }, { status: /not active|expired/i.test(message) ? 409 : 400 });
  }
}
