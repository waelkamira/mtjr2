import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listMyProductReviews } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listMyProductReviews(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Unable to load your reviews." }, { status: 500 });
  }
}
