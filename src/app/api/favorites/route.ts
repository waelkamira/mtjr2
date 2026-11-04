import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listMyFavorites } from "@/server/wishlist/favorites";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listMyFavorites() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to view your wishlist." }, { status: 401 });
    return Response.json({ error: "Unable to load your wishlist." }, { status: 500 });
  }
}
