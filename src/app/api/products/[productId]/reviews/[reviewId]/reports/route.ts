import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createReviewReport } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ productId: string; reviewId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId, reviewId } = await context.params;
    const report = await createReviewReport("PRODUCT", productId, reviewId, await request.json());
    return Response.json({ report }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to report a review." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid report details.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to submit review report.";
    return Response.json({ error: message }, { status: /already reported/i.test(message) ? 409 : 400 });
  }
}
