import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { finalizeSupportAttachmentUpload, startSupportAttachmentUpload } from "@/server/support/attachments";

export const runtime = "nodejs";
type Context = { params: Promise<{ ticketId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { ticketId } = await context.params;
    return Response.json(await startSupportAttachmentUpload(ticketId, await request.json()), {
      status: 201, headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "Unable to start attachment upload.";
    return Response.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { ticketId } = await context.params;
    const body = await request.json() as { attachmentId?: unknown };
    if (typeof body.attachmentId !== "string") return Response.json({ error: "attachmentId is required." }, { status: 400 });
    return Response.json(await finalizeSupportAttachmentUpload(ticketId, body.attachmentId), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "Unable to verify attachment.";
    return Response.json({ error: message }, { status: message.includes("not found") ? 404 : message.includes("not configured") ? 503 : 400 });
  }
}
