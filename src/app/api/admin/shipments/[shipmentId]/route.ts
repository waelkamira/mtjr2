import { z } from "zod";
import { getAdminShipment } from "@/server/admin/logistics";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";

export const runtime = "nodejs";
type Context = { params: Promise<{ shipmentId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { shipmentId } = await context.params;
    return Response.json({ shipment: await getAdminShipment(shipmentId) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid shipment ID." }, { status: 400 });
    if (error instanceof Error && error.message === "Shipment was not found.") return Response.json({ error: error.message }, { status: 404 });
    return Response.json({ error: "Unable to load shipment details." }, { status: 500 });
  }
}
