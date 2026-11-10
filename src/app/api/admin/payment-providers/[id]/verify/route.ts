import { z } from "zod";
import { verifyPaymentProviderConfig } from "@/server/admin/payment-providers";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { StepUpRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/access-errors";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { id } = await context.params;
    return Response.json({ item: await verifyPaymentProviderConfig(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Super Admin permission required." }, { status: 403 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) return Response.json({ error: "Complete the required MFA verification before verifying provider credentials." }, { status: 428 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid provider reference." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Provider verification failed." }, { status: 400 });
  }
}
