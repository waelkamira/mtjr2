import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { receiveStockTransfer } from "@/server/inventory/stock";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ transferId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { transferId } = await context.params;
    return Response.json(await receiveStockTransfer(transferId));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to receive transfer." }, { status: 400 });
  }
}
