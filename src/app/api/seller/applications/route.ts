import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { submitSellerApplication } from "@/server/marketplace/seller-application";

export const runtime = "nodejs";
const bodySchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254),
  phoneNumber: z.string().trim().min(7).max(25).regex(/^\+?[0-9\s().-]{7,25}$/),
  residence: z.string().trim().min(3).max(240),
  businessType: z.enum(["INDIVIDUAL", "STORE", "ARTISAN", "AGENCY", "OTHER"]),
  sellingCategories: z.string().trim().min(2).max(300),
  intendedProducts: z.string().trim().min(20).max(4000),
  description: z.string().trim().max(2000).optional(),
  facebookUrl: z.string().trim().max(2048).optional(),
  youtubeUrl: z.string().trim().max(2048).optional(),
  twitterUrl: z.string().trim().max(2048).optional(),
  identityDocumentFileId: z.string().trim().max(255).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180)
}).strict();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid seller application." }, { status: 400 });
  try {
    const result = await submitSellerApplication(parsed.data);
    return Response.json(result, { status: result.alreadySubmitted ? 200 : 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof Error && /verify your email/i.test(error.message)) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit seller application." }, { status: 400 });
  }
}
