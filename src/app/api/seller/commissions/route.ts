import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import {
  getSellerCommissionHistory,
  SellerCommissionStoreNotFoundError
} from "@/server/marketplace/seller-commissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ storeId: z.string().trim().min(1).max(128) }).strict();

export async function GET(request: Request): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return Response.json({ error: "A valid store ID is required." }, { status: 400 });
  try {
    return Response.json(await getSellerCommissionHistory(parsed.data.storeId), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Only the store owner can view commission statements." }, { status: 403 });
    if (error instanceof SellerCommissionStoreNotFoundError) return Response.json({ error: "Store not found." }, { status: 404 });
    return Response.json({ error: "Unable to load seller commission statements." }, { status: 500 });
  }
}
