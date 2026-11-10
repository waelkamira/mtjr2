import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/current-session";
import { z } from "zod";
import { createSearchSynonym, listSearchSynonyms } from "@/server/search/synonyms";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid search synonym.", issues: error.issues }, { status: 400 });
  const message = error instanceof Error ? error.message : "Unable to manage search synonyms.";
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: message }, { status: 403 });
  if (/already exists/i.test(message)) return Response.json({ error: message }, { status: 409 });
  return Response.json({ error: "Unable to manage search synonyms." }, { status: 500 });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listSearchSynonyms() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ item: await createSearchSynonym(body) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
