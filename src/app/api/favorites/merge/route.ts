import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { mergeGuestFavorites } from "@/server/wishlist/favorites";

export const runtime = "nodejs";
const bodySchema = z.object({ productIds: z.array(z.string().trim().min(1).max(128)).max(100) }).strict();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid guest wishlist." }, { status: 400 });
  try {
    return Response.json(await mergeGuestFavorites(parsed.data.productIds), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to merge your wishlist." }, { status: 401 });
    return Response.json({ error: "Unable to merge guest wishlist." }, { status: 500 });
  }
}
