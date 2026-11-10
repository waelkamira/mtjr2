import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { reviewSellerReturnItems } from "@/server/returns/seller-returns";
import { receiveSellerReturnItems } from "@/server/returns/return-receipt";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ returnId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { returnId } = await context.params;
    const body = await request.json() as { status?: string };
    const result = body.status === "RECEIVED"
      ? await receiveSellerReturnItems(returnId, body)
      : await reviewSellerReturnItems(returnId, body);
    return Response.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Return decision could not be saved.";
    const status = /not found/i.test(message) ? 404 : /permission denied/i.test(message) ? 403 : /already been reviewed|not open|not active/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
