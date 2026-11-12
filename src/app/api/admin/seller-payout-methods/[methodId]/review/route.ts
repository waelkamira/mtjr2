import { z } from "zod";
import { reviewSellerPayoutMethod, SellerPayoutMethodNotFoundError, SellerPayoutSelfVerificationError, SellerPayoutVerificationConflictError } from "@/server/marketplace/seller-payout-methods";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ methodId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { methodId } = await context.params;
    const input = await request.json();
    const method = await reviewSellerPayoutMethod(methodId, input);
    return Response.json({ method }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    // MFA errors inherit from PermissionDeniedError, so handle them first.
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) return Response.json({ error: "Complete the required MFA step-up verification before reviewing bank ownership." }, { status: 428 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Platform management permission required." }, { status: 403 });
    if (error instanceof SellerPayoutMethodNotFoundError) return Response.json({ error: "Bank destination not found." }, { status: 404 });
    if (error instanceof SellerPayoutSelfVerificationError) return Response.json({ error: "You cannot verify your own seller bank destination." }, { status: 403 });
    if (error instanceof SellerPayoutVerificationConflictError) return Response.json({ error: "This bank destination changed or was already reviewed. Refresh the queue and re-check the latest submission before deciding." }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Provide a valid review decision, evidence reference, and reason." }, { status: 400 });
    return Response.json({ error: "Unable to review seller bank destination." }, { status: 500 });
  }
}
