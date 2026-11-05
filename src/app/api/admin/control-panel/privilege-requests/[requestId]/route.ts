import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import {
  decidePlatformPrivilegeRequest,
  PlatformPrivilegeRequestConflictError
} from "@/server/admin/platform-privilege-requests";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  try {
    const { requestId } = await context.params;
    const body: unknown = await request.json();
    const result = await decidePlatformPrivilegeRequest(requestId, body);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof PlatformPrivilegeRequestConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid privilege decision." }, { status: 400 });
    return Response.json({ error: "Unable to process privilege decision." }, { status: 500 });
  }
}
