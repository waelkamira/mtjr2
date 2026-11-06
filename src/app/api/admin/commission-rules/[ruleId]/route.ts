import { z } from "zod";
import { deactivateCommissionRule } from "@/server/admin/commission-management";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = z.object({ reason: z.string().trim().min(5).max(500) }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "A deactivation reason is required." }, { status: 400 });
  try {
    const { ruleId } = await context.params;
    return Response.json({ rule: await deactivateCommissionRule(ruleId, parsed.data.reason) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid commission rule." }, { status: 400 });
    if (error instanceof Error && /not found|already inactive|concurrently/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json({ error: "Unable to deactivate commission rule." }, { status: 500 });
  }
}
