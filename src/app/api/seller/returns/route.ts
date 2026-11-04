import { AuthenticationRequiredError } from "@/server/identity/permission-guard";
import { listSellerReturnRequests } from "@/server/returns/seller-returns";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listSellerReturnRequests(), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Sign in to view store returns." }, { status: 401 });
    }
    return Response.json({ error: "Seller returns could not be loaded." }, { status: 500 });
  }
}
