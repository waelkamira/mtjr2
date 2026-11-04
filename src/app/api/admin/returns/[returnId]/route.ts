import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { reviewReturnRequest } from "@/server/returns/returns";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ returnId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { returnId } = await context.params;
    return Response.json({ request: await reviewReturnRequest(returnId, await request.json()) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Return request could not be updated." }, { status: 400 });
  }
}
