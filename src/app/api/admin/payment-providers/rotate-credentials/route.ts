import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { StepUpRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/access-errors";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { rotateStoredPaymentProviderCredentials } from "@/server/admin/payment-providers";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const result = await rotateStoredPaymentProviderCredentials();
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Super Admin permission required." }, { status: 403 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) {
      return Response.json({ error: "Complete the required MFA verification before rotating provider credentials." }, { status: 428 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Credential re-encryption failed." }, { status: 409 });
  }
}
