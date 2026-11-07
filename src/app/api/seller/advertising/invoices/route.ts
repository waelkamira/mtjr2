import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listSellerAdInvoices } from "@/server/advertising/delivery";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try { return Response.json({ items: await listSellerAdInvoices(storeId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load advertising invoices." }, { status: 403 });
  }
}
