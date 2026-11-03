import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listSellerProductQuestions } from "@/server/catalog/product-qa";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listSellerProductQuestions() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Unable to load seller questions." }, { status: 500 });
  }
}
