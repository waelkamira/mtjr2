import { getOrCreateGuestCartToken } from "@/server/cart/guest-cookie";
import { getActiveCarts } from "@/server/cart/cart";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const token = await getOrCreateGuestCartToken();
    return Response.json({ carts: await getActiveCarts(token) }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  } catch {
    return Response.json({ error: "Unable to load your cart." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
