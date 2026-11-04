import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listMyProductQuestions } from "@/server/catalog/product-qa";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listMyProductQuestions() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to view your questions." }, { status: 401 });
    return Response.json({ error: "Unable to load your questions." }, { status: 500 });
  }
}
