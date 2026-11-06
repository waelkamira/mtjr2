import { z } from "zod";
import { setCouponActive } from "@/server/checkout/coupons";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ couponId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const data = z.object({ isActive: z.boolean() }).strict().parse(body);
    const { couponId } = await context.params;
    return Response.json({ item: await setCouponActive(couponId, data.isActive) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid coupon update.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to update coupon.";
    const status = /authentication required/i.test(message) ? 401 : /permission|administration/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 500;
    return Response.json({ error: status === 500 ? "Unable to update coupon." : message }, { status });
  }
}
