import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { verifyUserEmail } from "@/server/identity/registration";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const token = body && typeof body === "object" && "token" in body && typeof body.token === "string"
    ? body.token : "";
  if (!token) return Response.json({ error: "Verification token is required." }, { status: 400 });
  try {
    const verified = await verifyUserEmail(token);
    return verified
      ? Response.json({ message: "Email verified. You can now sign in." })
      : Response.json({ error: "This verification link is invalid or expired." }, { status: 400 });
  } catch {
    return Response.json({ error: "Unable to verify this email right now." }, { status: 500 });
  }
}
