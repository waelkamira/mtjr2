import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENTS = {
  identity: { field: "identityDocumentFileId", tag: "matjar-seller-identity" },
  businessRegistration: { field: "businessRegistrationDocumentFileId", tag: "matjar-seller-business-registration" },
  taxCertificate: { field: "taxCertificateDocumentFileId", tag: "matjar-seller-tax-certificate" },
  proofOfAddress: { field: "proofOfAddressDocumentFileId", tag: "matjar-seller-proof-of-address" }
} as const;

export async function GET(_request: Request, context: { params: Promise<{ sellerId: string; documentType: string }> }): Promise<Response> {
  try {
    await requirePermission({ permissionKey: "users:manage" });
    const { sellerId, documentType } = await context.params;
    if (!Object.hasOwn(DOCUMENTS, documentType)) return Response.json({ error: "Unsupported document type." }, { status: 404 });
    const document = DOCUMENTS[documentType as keyof typeof DOCUMENTS];
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true, ownerId: true, identityDocumentFileId: true,
        businessRegistrationDocumentFileId: true, taxCertificateDocumentFileId: true,
        proofOfAddressDocumentFileId: true
      }
    });
    if (!seller) return Response.json({ error: "Seller application not found." }, { status: 404 });
    const fileId = seller[document.field];
    if (!fileId) return Response.json({ error: "No document was attached." }, { status: 404 });
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
    if (!privateKey) return Response.json({ error: "Private document storage is not configured." }, { status: 503 });
    const detailsResponse = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
      headers: { Authorization: "Basic " + Buffer.from(privateKey + ":").toString("base64") },
      signal: AbortSignal.timeout(10000),
      cache: "no-store"
    });
    if (!detailsResponse.ok) return Response.json({ error: "The private document could not be retrieved." }, { status: 502 });
    const details = await detailsResponse.json() as { url?: string; isPrivateFile?: boolean; tags?: string[] | null };
    if (!details.isPrivateFile || !(details.tags ?? []).includes(document.tag) || !(details.tags ?? []).includes("user-" + seller.ownerId) || !details.url) {
      return Response.json({ error: "The stored document failed its privacy and ownership checks." }, { status: 403 });
    }
    const url = new URL(details.url);
    if (url.protocol !== "https:") return Response.json({ error: "The stored document URL is invalid." }, { status: 502 });
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const signature = createHmac("sha1", privateKey).update(url.pathname.slice(1) + expiresAt).digest("hex");
    url.searchParams.set("ik-t", String(expiresAt));
    url.searchParams.set("ik-s", signature);
    return Response.redirect(url.toString(), 302);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: "Unable to open the seller verification document." }, { status: 500 });
  }
}
