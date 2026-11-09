import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { cancelStockCount } from "@/server/inventory/stock";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ countId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { countId } = await context.params;
    return Response.json(await cancelStockCount(countId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "Unable to cancel stock count.";
    return Response.json({ error: message }, { status: message.includes("access") ? 403 : message.includes("not found") ? 404 : 400 });
  }
}
