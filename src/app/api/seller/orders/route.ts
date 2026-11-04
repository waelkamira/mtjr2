import { listSellerVendorOrders } from "@/server/orders/seller-orders";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    return Response.json(await listSellerVendorOrders(new Date(), { q }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load seller orders.";
    return Response.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 400 });
  }
}
