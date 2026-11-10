import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/access-errors";
import {
  disableSellerPayoutMethod,
  SellerPayoutMethodNotFoundError,
  setSellerPayoutMethodDefault
} from "@/server/marketplace/seller-payout-methods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ methodId: string }> };

export async function PATCH(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { methodId } = await context.params;
    const method = await setSellerPayoutMethodDefault(methodId);
    return Response.json({ method }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Seller owner access required." }, { status: 403 });
    if (error instanceof SellerPayoutMethodNotFoundError) return Response.json({ error: "Bank account not found." }, { status: 404 });
    return Response.json({ error: "Unable to update default bank account." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { methodId } = await context.params;
    const method = await disableSellerPayoutMethod(methodId);
    return Response.json({ method }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Seller owner access required." }, { status: 403 });
    if (error instanceof SellerPayoutMethodNotFoundError) return Response.json({ error: "Bank account not found." }, { status: 404 });
    return Response.json({ error: "Unable to remove bank account." }, { status: 500 });
  }
}
