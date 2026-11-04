import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { transitionSellerVendorOrder } from "@/server/orders/seller-orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ vendorOrderId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { vendorOrderId } = await context.params;
    const vendorOrder = await transitionSellerVendorOrder(vendorOrderId, await request.json());
    return Response.json({ vendorOrder }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Seller order could not be updated.";
    const status = /not found/i.test(message) ? 404 : /cannot move|changed|not confirmed|not active/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
