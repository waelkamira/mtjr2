import { z } from "zod";
import { createPaymentProviderConfig, listPaymentProviderConfigs } from "@/server/admin/payment-providers";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { StepUpRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/access-errors";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: "Super Admin permission required." }, { status: 403 });
  if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) {
    return Response.json({ error: "Complete the required MFA verification before changing payment providers." }, { status: 428 });
  }
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid provider configuration.", issues: error.issues }, { status: 400 });
  if (error instanceof Error && /already exists|unique constraint/i.test(error.message)) return Response.json({ error: "This provider already has a configuration for the selected environment." }, { status: 409 });
  return Response.json({ error: error instanceof Error ? error.message : "Unable to manage payment providers." }, { status: 400 });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listPaymentProviderConfigs(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ item: await createPaymentProviderConfig(body) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
