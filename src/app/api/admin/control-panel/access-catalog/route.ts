import {
  AuthenticationRequiredError,
  EmailVerificationRequiredError,
  PermissionDeniedError,
  MfaEnrollmentRequiredError,
  StepUpRequiredError
} from "@/server/identity/permission-guard";
import { getPlatformAccessCatalog } from "@/server/admin/platform-access-catalog";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await getPlatformAccessCatalog(), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError) return Response.json({ error: "Verified email is required.", code: "EMAIL_VERIFICATION_REQUIRED" }, { status: 403 });
    if (error instanceof MfaEnrollmentRequiredError) return Response.json({ error: "MFA enrollment is required.", code: "MFA_ENROLLMENT_REQUIRED" }, { status: 403 });
    if (error instanceof StepUpRequiredError) return Response.json({ error: "Recent MFA verification is required.", code: "STEP_UP_REQUIRED" }, { status: 428 });
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: "Permission denied." }, { status: 403 });
    }
    return Response.json({ error: "Unable to load the platform access catalogue." }, { status: 500 });
  }
}
