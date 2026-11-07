import { z } from "zod";
import { createCoupon, listCoupons } from "@/server/checkout/coupons";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";

export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid coupon.", issues: error.issues }, { status: 400 });
  const message = error instanceof Error ? error.message : "Unable to manage coupons.";
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: message }, { status: 403 });
  if (/unique constraint|already exists/i.test(message)) return Response.json({ error: "A coupon with this code already exists." }, { status: 409 });
  return Response.json({ error: "Unable to manage coupons." }, { status: 500 });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listCoupons() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ item: await createCoupon(body) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
