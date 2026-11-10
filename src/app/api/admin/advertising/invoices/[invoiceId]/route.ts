import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { settleAdInvoice } from "@/server/advertising/delivery";

export const runtime = "nodejs";
type Context = { params: Promise<{ invoiceId: string }> };
export async function PATCH(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = z.object({ paymentReference: z.string().trim().min(3).max(180) }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "A verified payment reference is required." }, { status: 400 });
  try {
    const { invoiceId } = await context.params;
    return Response.json({ item: await settleAdInvoice(invoiceId, parsed.data.paymentReference) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    const message = error instanceof Error ? error.message : "Unable to settle invoice.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 409 });
  }
}
