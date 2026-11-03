import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createSellerStore, getSellerWorkspace } from "@/server/marketplace/seller-application";

export const runtime = "nodejs";
const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  marketIds: z.array(z.string().trim().min(1)).min(1).max(20)
}).strict();

export async function GET(): Promise<Response> {
  try { return Response.json(await getSellerWorkspace()); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load seller workspace." }, { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid store details." }, { status: 400 });
  try {
    const result = await createSellerStore(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof Error && /permission/i.test(error.message)) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create store." }, { status: 400 });
  }
}
