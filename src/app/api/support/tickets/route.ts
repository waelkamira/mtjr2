import { z } from "zod";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

import { createSupportTicket, listMySupportTickets } from "@/server/support/tickets";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listMySupportTickets() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to view support requests." }, { status: 401 });
    return Response.json({ error: "Unable to load support requests." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    return Response.json({ ticket: await createSupportTicket(await request.json()) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to contact support." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Check the subject, category and message fields." }, { status: 400 });
    return Response.json({ error: "Unable to create support request." }, { status: 400 });
  }
}
