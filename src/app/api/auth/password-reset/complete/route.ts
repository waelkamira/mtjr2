import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { completePasswordReset } from "@/server/identity/password-reset";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("token" in body) || !("password" in body) ||
      typeof body.token !== "string" || typeof body.password !== "string") {
    return Response.json({ error: "Invalid reset request." }, { status: 400 });
  }

  const completed = await completePasswordReset(body.token, body.password);
  return completed
    ? Response.json({ passwordChanged: true })
    : Response.json({ error: "Reset link is invalid or expired." }, { status: 400 });
}
