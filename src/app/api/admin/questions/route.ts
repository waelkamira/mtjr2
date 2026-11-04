import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { listPendingProductQa } from "@/server/catalog/product-qa";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listPendingProductQa(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: "Unable to load product Q&A moderation queue." }, { status: 500 });
  }
}
