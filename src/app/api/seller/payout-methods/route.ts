import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthenticationRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { PermissionDeniedError } from "@/server/identity/access-errors";
import { createSellerPayoutMethod, listSellerPayoutMethods, SellerPayoutValidationError } from "@/server/marketplace/seller-payout-methods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ methods: await listSellerPayoutMethods() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError) return Response.json({ error: "Complete multi-factor authentication enrollment before managing bank accounts." }, { status: 403 });
    if (error instanceof MfaVerificationRequiredError) return Response.json({ error: "Complete multi-factor authentication verification before managing bank accounts." }, { status: 403 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "An active seller owner account is required." }, { status: 403 });
    return Response.json({ error: "Unable to load bank accounts." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const body: unknown = await request.json();
    const method = await createSellerPayoutMethod(body);
    return Response.json({ method, message: "Bank account saved and awaiting verification. Transfers are not enabled yet." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError) return Response.json({ error: "Complete multi-factor authentication enrollment before managing bank accounts." }, { status: 403 });
    if (error instanceof MfaVerificationRequiredError) return Response.json({ error: "Complete multi-factor authentication verification before managing bank accounts." }, { status: 403 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "An active seller owner account is required." }, { status: 403 });
    if (error instanceof SellerPayoutValidationError || error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      return Response.json({ error: "This bank account conflicts with another update. Refresh and try again." }, { status: 409 });
    }
    return Response.json({ error: "Unable to save bank account." }, { status: 500 });
  }
}
