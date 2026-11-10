import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createReviewAppeal } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ reviewId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { reviewId } = await context.params;
    const body = z.object({ kind: z.enum(["PRODUCT", "STORE"]), reason: z.string().trim().min(20).max(2000) }).strict().parse(await request.json());
    const appeal = await createReviewAppeal(body.kind, reviewId, { reason: body.reason });
    return Response.json({ appeal }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to appeal a review decision." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid appeal details.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to submit review appeal.";
    return Response.json({ error: message }, { status: /already been submitted/i.test(message) ? 409 : 400 });
  }
}
