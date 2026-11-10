import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { PermissionDeniedError } from "@/server/identity/access-errors";
import { createSellerPayoutMethod, listSellerPayoutMethods } from "@/server/marketplace/seller-payout-methods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ methods: await listSellerPayoutMethods() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
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
    if (error instanceof PermissionDeniedError) return Response.json({ error: "An active seller owner account is required." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Unable to save bank account.";
    const status = error instanceof z.ZodError || error instanceof SyntaxError || /valid|choose|already saved|checksum|account number|routing|currency|not enabled|not supported|local bank account/i.test(message) ? 400 : 500;
    return Response.json({ error: status === 400 ? message : "Unable to save bank account." }, { status });
  }
}
