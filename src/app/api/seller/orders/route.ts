import { listSellerVendorOrders } from "@/server/orders/seller-orders";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listSellerVendorOrders(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load seller orders.";
    return Response.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 400 });
  }
}
