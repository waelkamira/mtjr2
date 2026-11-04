import { listCustomerOrders } from "@/server/orders/orders";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ orders: await listCustomerOrders() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load orders.";
    return Response.json({ error: message }, { status: /sign in/i.test(message) ? 401 : 400 });
  }
}
