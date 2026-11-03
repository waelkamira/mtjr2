import { ZodError } from "zod";
import { resendEmailAdapter } from "@/server/email/resend";
import { IdentityConflictError, registerUser } from "@/server/identity/registration";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid registration details." }, { status: 400 });
    const result = await registerUser(body as Parameters<typeof registerUser>[0]);
    try {
      await resendEmailAdapter.sendVerificationEmail(
        (body as { email: string }).email.trim().toLowerCase(),
        result.verificationToken
      );
    } catch {
      // Never return a raw verification token. The user may request a resend.
      return Response.json({ message: "Account created. Email delivery is temporarily unavailable; request a verification email again later." }, { status: 202 });
    }
    return Response.json({ message: "Account created. Check your email to verify your address." }, { status: 201 });
  } catch (error) {
    if (error instanceof IdentityConflictError) {
      return Response.json({ message: "If eligible, an account verification message will be sent." }, { status: 202 });
    }
    if (error instanceof ZodError) return Response.json({ error: "Invalid registration details." }, { status: 400 });
    return Response.json({ error: "Unable to complete registration." }, { status: 500 });
  }
}
