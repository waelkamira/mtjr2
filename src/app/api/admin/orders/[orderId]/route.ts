import { z } from "zod";
import { getAdminOrder } from "@/server/admin/orders";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";

export const runtime = "nodejs";
type Context = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { orderId } = await context.params;
    return Response.json({ order: await getAdminOrder(orderId) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid order ID." }, { status: 400 });
    if (error instanceof Error && error.message === "Order was not found.") return Response.json({ error: error.message }, { status: 404 });
    return Response.json({ error: "Unable to load order." }, { status: 500 });
  }
}
