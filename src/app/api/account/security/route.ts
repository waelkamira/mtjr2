import { z } from "zod";
import { getCurrentSession } from "@/server/identity/current-session";
import { changePassword } from "@/server/identity/password-change";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128)
}).strict();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter your current password and a new password of 12–128 characters." }, { status: 400 });
  }

  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });

    const result = await changePassword({
      userId: session.userId,
      currentSessionId: session.id,
      ...parsed.data
    });
    if (result === "UPDATED") {
      return Response.json({ message: "Password updated. Other active sessions were signed out." });
    }
    if (result === "INVALID_CURRENT_PASSWORD") {
      return Response.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (result === "PASSWORD_NOT_SET") {
      return Response.json({ error: "Set a password using the password recovery flow first." }, { status: 409 });
    }
    if (result === "PASSWORD_UNCHANGED") {
      return Response.json({ error: "Choose a new password that differs from your current password." }, { status: 400 });
    }
    return Response.json({ error: "Account security changed during this request. Please try again." }, { status: 409 });
  } catch {
    return Response.json({ error: "Unable to update your password right now." }, { status: 500 });
  }
}
