import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { completeManualRefund, executeProviderRefund, refreshProviderRefundStatus } from "@/server/payments/refunds";
import { z } from "zod";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ refundId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
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


const providerActionSchema = z.object({ action: z.enum(["execute", "refresh"]) }).strict();

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { refundId } = await context.params;
    const body = providerActionSchema.parse(await request.json());
    const result = body.action === "execute"
      ? await executeProviderRefund(refundId)
      : await refreshProviderRefundStatus(refundId);
    return Response.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid provider refund action." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Provider refund operation failed.";
    const status = /not found/i.test(message) ? 404 : /already|changed|exceed|refundable state|processing state|pending or retryable|provider reference|idempotency retention window/i.test(message) ? 409 : 502;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
