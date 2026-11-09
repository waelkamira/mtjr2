import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { getMySellerProfile, updateMySellerProfile } from "@/server/marketplace/seller-profile";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ profile: await getMySellerProfile() }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "An active seller profile is required." }, { status: 403 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: "Unable to load seller profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ profile: await updateMySellerProfile(body) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "An active seller profile is required." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid seller profile.", issues: error.issues }, { status: 400 });
    return Response.json({ error: "Unable to save seller profile." }, { status: 500 });
  }
}
