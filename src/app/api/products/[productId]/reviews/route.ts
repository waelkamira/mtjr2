import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createVerifiedProductReview, listPublicProductReviews } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ productId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { productId } = await context.params;
    const url = new URL(request.url);
    const reviews = await listPublicProductReviews(productId, {
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined
    });
    return Response.json(reviews, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid review query." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load reviews." }, { status: 404 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId } = await context.params;
    const review = await createVerifiedProductReview(productId, await request.json());
    return Response.json({ review }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to write a review." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid review details.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to submit review.";
    return Response.json({ error: message }, { status: /already reviewed|delivered purchase/i.test(message) ? 409 : 400 });
  }
}
