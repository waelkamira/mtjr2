import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { completeManualRefund } from "@/server/payments/refunds";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ refundId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { refundId } = await context.params;
    const result = await completeManualRefund(refundId, await request.json());
    return Response.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Refund completion could not be recorded.";
    const status = /not found/i.test(message) ? 404 : /already|changed|exceed|refundable state|pending manual/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
