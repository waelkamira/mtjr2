import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { getStockCount } from "@/server/inventory/stock";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ countId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { countId } = await context.params;
    return Response.json(await getStockCount(countId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "Unable to load stock count.";
    return Response.json({ error: message }, { status: message.includes("access") ? 403 : 404 });
  }
}
