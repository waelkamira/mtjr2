import { z } from "zod";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { transitionFinancialPolicyVersion } from "@/server/admin/financial-policy-management";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ versionId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }

  try {
    const { versionId } = await context.params;
    return Response.json({ version: await transitionFinancialPolicyVersion(versionId, body) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid policy review action.", details: error.issues }, { status: 400 });
    if (error instanceof Error && /not found|cannot|requires|only pending/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json({ error: "Unable to update financial policy review status." }, { status: 500 });
  }
}
