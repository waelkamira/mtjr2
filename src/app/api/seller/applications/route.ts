import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError
} from "@/server/identity/current-session";
import {
  SellerApplicationConflictError,
  submitSellerApplication
} from "@/server/marketplace/seller-application";

export const runtime = "nodejs";
const bodySchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(80)
}).strict();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid seller application." }, { status: 400 });
  try {
    const result = await submitSellerApplication(parsed.data);
    return Response.json(result, { status: result.alreadySubmitted ? 200 : 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError) {
      return Response.json({ error: "Complete multi-factor authentication before continuing." }, { status: 403 });
    }
    if (error instanceof SellerApplicationConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json({ error: "Unable to submit seller application." }, { status: 500 });
  }
}
