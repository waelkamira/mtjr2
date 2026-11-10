import { AuthenticationRequiredError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createMyReturnRequest, getMyReturnCenter } from "@/server/returns/returns";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await getMyReturnCenter(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to manage returns." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Returns are unavailable." }, { status: 400 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const result = await createMyReturnRequest(body);
    return Response.json({ request: result }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to request a return." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Return request could not be created." }, { status: 400 });
  }
}
