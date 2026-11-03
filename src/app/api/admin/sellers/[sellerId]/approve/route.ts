import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { reviewSellerApplication } from "@/server/marketplace/seller-application";

export const runtime = "nodejs";
const bodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional()
}).strict();

export async function POST(request: Request, context: { params: Promise<{ sellerId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid review decision." }, { status: 400 });
  try {
    const { sellerId } = await context.params;
    const result = await reviewSellerApplication({ sellerId, ...parsed.data });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to review seller." }, { status: 400 });
  }
}
