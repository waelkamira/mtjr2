import { z } from "zod";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { adminReplyToSupportTicket, getAdminSupportTicket, updateSupportTicket } from "@/server/support/tickets";

export const runtime = "nodejs";
type Context = { params: Promise<{ ticketId: string }> };

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid support action." }, { status: 400 });
  const message = error instanceof Error ? error.message : "Support action failed.";
  return Response.json({ error: message }, { status: message.includes("not found") ? 404 : 409 });
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try { const { ticketId } = await context.params; return Response.json({ ticket: await getAdminSupportTicket(ticketId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request); if (rejected) return rejected;
  try { const { ticketId } = await context.params; return Response.json({ message: await adminReplyToSupportTicket(ticketId, await request.json()) }, { status: 201, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request); if (rejected) return rejected;
  try { const { ticketId } = await context.params; return Response.json({ ticket: await updateSupportTicket(ticketId, await request.json()) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}
