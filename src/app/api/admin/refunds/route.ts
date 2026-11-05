import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { createManualRefundForReturn, listRefundOperations } from "@/server/payments/refunds";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listRefundOperations(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Refund queue is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const result = await createManualRefundForReturn(await request.json());
    return Response.json({ result }, { status: result.alreadyApplied ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Refund request could not be created.";
    const status = /not found/i.test(message) ? 404 : /already|exceed|refundable|captured payment|received/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
