import { AuthenticationRequiredError } from "@/server/identity/permission-guard";
import { getMyReturnRequest } from "@/server/returns/returns";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ returnId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { returnId } = await context.params;
    return Response.json({ request: await getMyReturnRequest(returnId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Return request not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}
