import { z } from "zod";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

import { getMySupportTicket, replyToMySupportTicket } from "@/server/support/tickets";

export const runtime = "nodejs";
type Context = { params: Promise<{ ticketId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { ticketId } = await context.params;
    return Response.json({ ticket: await getMySupportTicket(ticketId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Support ticket not found." }, { status: 404 });
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { ticketId } = await context.params;
    return Response.json({ message: await replyToMySupportTicket(ticketId, await request.json()) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Message must contain 2 to 8,000 characters." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to reply.";
    return Response.json({ error: message }, { status: message.includes("not found") ? 404 : 409 });
  }
}
