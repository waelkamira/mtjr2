import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listMyReviewableOrderItems } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const productId = new URL(request.url).searchParams.get("productId") ?? "";
    return Response.json({ items: await listMyReviewableOrderItems(productId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to review a purchase." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load eligible purchases." }, { status: 400 });
  }
}
