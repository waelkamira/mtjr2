// Backward-compatible endpoint for older seller dashboard clients.
import { POST as uploadProductImage } from "../media/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return uploadProductImage(request);
}
