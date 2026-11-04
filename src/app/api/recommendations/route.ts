import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listMyRecommendations } from "@/server/wishlist/recommendations";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listMyRecommendations(), {
      headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Sign in to view personalized recommendations." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
    return Response.json({ error: "Recommendations are temporarily unavailable." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
