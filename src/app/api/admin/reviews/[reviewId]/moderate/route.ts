import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { moderateProductReview } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ reviewId: string }> };
const schema = z.object({ decision: z.enum(["PUBLISH", "REJECT", "HIDE"]), reason: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { reviewId } = await context.params;
    const body = schema.parse(await request.json());
    return Response.json({ review: await moderateProductReview(reviewId, body.decision, body.reason) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid moderation action." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to moderate review." }, { status: 409 });
  }
}
