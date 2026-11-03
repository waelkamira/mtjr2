import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { inviteStoreStaff, listStoreStaff } from "@/server/marketplace/store-staff";

export const runtime = "nodejs";
const bodySchema = z.object({ userId: z.string().trim().min(1).max(128) }).strict();

export async function GET(_request: Request, context: { params: Promise<{ storeId: string }> }): Promise<Response> {
  try {
    const { storeId } = await context.params;
    return Response.json({ items: await listStoreStaff(storeId) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load store staff." }, { status: 403 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ storeId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid staff invitation." }, { status: 400 });
  try {
    const { storeId } = await context.params;
    const result = await inviteStoreStaff({ storeId, userId: parsed.data.userId });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to invite staff." }, { status: 400 });
  }
}
