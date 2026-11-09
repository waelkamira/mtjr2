import { z } from "zod";
import { archivePaymentProviderConfig, updatePaymentProviderConfig } from "@/server/admin/payment-providers";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { StepUpRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/access-errors";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: "Super Admin permission required." }, { status: 403 });
  if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) return Response.json({ error: "Complete the required MFA verification before changing payment providers." }, { status: 428 });
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid provider configuration.", issues: error.issues }, { status: 400 });
  if (error instanceof Error && /not found/i.test(error.message)) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ error: error instanceof Error ? error.message : "Unable to update payment provider." }, { status: 400 });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { id } = await context.params;
    return Response.json({ item: await updatePaymentProviderConfig(id, body) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { id } = await context.params;
    return Response.json({ item: await archivePaymentProviderConfig(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
