// Backward-compatible endpoint for older seller dashboard clients.
import { POST as uploadProductImage } from "../media/route";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  return uploadProductImage(request);
}
