import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { approveSellerAndCreateStore } from "@/server/marketplace/store-lifecycle";

export const runtime = "nodejs";
const bodySchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  storeSlug: z.string().trim().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  marketIds: z.array(z.string().trim().min(1)).min(1).max(20)
}).strict();

export async function POST(request: Request, context: { params: Promise<{ sellerId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid store details." }, { status: 400 });
  try {
    const { sellerId } = await context.params;
    const result = await approveSellerAndCreateStore({ sellerId, ...parsed.data });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to approve seller." }, { status: 400 });
  }
}
