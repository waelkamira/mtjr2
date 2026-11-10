import { z } from "zod";
import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { addCartItem } from "@/server/cart/cart";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

const bodySchema = z.object({
  marketId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3),
  variantId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(99).default(1)
}).strict();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid cart item.", issues: parsed.error.issues }, { status: 400 });
  try {
    const token = await getOrCreateGuestCartToken();
    const result = await addCartItem(token, parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid cart item." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to add this item.";
    const status = /not enough|maximum|unavailable|no longer available/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
