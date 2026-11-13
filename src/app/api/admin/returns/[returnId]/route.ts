import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { reviewReturnRequest } from "@/server/returns/returns";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ returnId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { returnId } = await context.params;
    return Response.json({ request: await reviewReturnRequest(returnId, await request.json()) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Return request could not be updated.";
    const status = /not found/i.test(message) ? 404 : /only pending|changed|no pending return items/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
