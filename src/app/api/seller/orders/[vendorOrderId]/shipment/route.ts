import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createSellerShipment } from "@/server/orders/seller-orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ vendorOrderId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { vendorOrderId } = await context.params;
    const shipment = await createSellerShipment(vendorOrderId, body);
    return Response.json({ shipment }, { status: shipment.changed ? 201 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Shipment could not be created.";
    const status = /not found/i.test(message) ? 404
      : /already exists|only .*ready|not eligible|not active|changed/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
