// Backward-compatible endpoint for older seller dashboard clients.
import { POST as uploadProductImage, DELETE as deleteTemporaryProductImage } from "../media/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // The canonical media route performs origin validation, authentication and
  // multipart content-type validation in the correct order.
  return uploadProductImage(request);
}


export async function DELETE(request: Request): Promise<Response> {
  return deleteTemporaryProductImage(request);
}
