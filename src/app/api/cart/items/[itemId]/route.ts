import { z } from "zod";
import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { removeCartItem, updateCartItemQuantity } from "@/server/cart/cart";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

const quantitySchema = z.object({ quantity: z.number().int().min(1).max(99) }).strict();

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = quantitySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Quantity must be an integer between 1 and 99." }, { status: 400 });
  try {
    const { itemId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json(await updateCartItemQuantity(token, itemId, parsed.data.quantity));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update this cart item.";
    const status = /not enough|not found|unavailable/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { itemId } = await context.params;
    const token = await getOrCreateGuestCartToken();
    return Response.json(await removeCartItem(token, itemId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove this cart item.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
