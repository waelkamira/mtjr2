import { z } from "zod";
import { deleteSearchSynonym, updateSearchSynonym } from "@/server/search/synonyms";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid search synonym.", issues: error.issues }, { status: 400 });
  const message = error instanceof Error ? error.message : "Unable to update search synonym.";
  if (/authentication required/i.test(message)) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (/permission|administration/i.test(message)) return Response.json({ error: message }, { status: 403 });
  if (/not found/i.test(message)) return Response.json({ error: message }, { status: 404 });
  return Response.json({ error: "Unable to update search synonym." }, { status: 500 });
}

export async function PATCH(request: Request, context: { params: Promise<{ synonymId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { synonymId } = await context.params;
    return Response.json({ item: await updateSearchSynonym(synonymId, body) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ synonymId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { synonymId } = await context.params;
    return Response.json(await deleteSearchSynonym(synonymId));
  } catch (error) {
    return failure(error);
  }
}
