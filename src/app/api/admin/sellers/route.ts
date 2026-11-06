import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { listAdminSellers } from "@/server/admin/sellers";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return Response.json(await listAdminSellers(params), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid seller search filters." }, { status: 400 });
    return Response.json({ error: "Unable to load seller review queue." }, { status: 500 });
  }
}
