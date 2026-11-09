import { listSellerVendorOrders } from "@/server/orders/seller-orders";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const q = params.get("q") ?? undefined;
    const storeId = params.get("storeId") ?? undefined;
    return Response.json(await listSellerVendorOrders(new Date(), { q, storeId }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load seller orders.";
    return Response.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 400 });
  }
}
