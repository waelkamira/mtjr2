import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { addFavorite, getFavoriteStatus, removeFavorite } from "@/server/wishlist/favorites";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ productId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { productId } = await context.params;
    return Response.json(await getFavoriteStatus(productId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to use your wishlist." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load favorite status." }, { status: 400 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId } = await context.params;
    return Response.json(await addFavorite(productId), { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to save favorites." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save favorite." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId } = await context.params;
    return Response.json(await removeFavorite(productId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to manage your wishlist." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to remove favorite." }, { status: 400 });
  }
}
