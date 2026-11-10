import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { respondToStoreReview } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ reviewId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { reviewId } = await context.params;
    const body = z.object({ response: z.string().trim().min(3).max(2000) }).strict().parse(await request.json());
    return Response.json({ review: await respondToStoreReview(reviewId, body.response) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid seller response." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save seller response." }, { status: 403 });
  }
}
