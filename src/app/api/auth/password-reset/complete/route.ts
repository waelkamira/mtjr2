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
      typeof body.token !== "string" || typeof body.password !== "string" ||
      body.password.length < 12 || body.password.length > 128) {
    return Response.json({ error: "A valid token and password (12–128 characters) are required." }, { status: 400 });
  }
  try {
    const completed = await completePasswordReset(body.token, body.password);
    return completed
      ? Response.json({ message: "Password updated. Sign in again with your new password." })
      : Response.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  } catch {
    return Response.json({ error: "Unable to reset password right now." }, { status: 500 });
  }
}
