import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/current-session";
import { SellerApplicationConflictError, submitSellerApplication } from "@/server/marketplace/seller-application";

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
  registrationCountryCode: z.string().trim().length(2).optional(),
  registrationNumber: z.string().trim().max(120).optional(),
  registrationAuthority: z.string().trim().max(160).optional(),
  registrationDate: z.string().trim().max(10).optional(),
  registeredAddress: z.string().trim().max(500).optional(),
  taxIdentificationNumber: z.string().trim().max(120).optional(),
  businessWebsite: z.string().trim().max(2048).optional(),
  businessRegistrationDocumentFileId: z.string().trim().max(255).optional(),
  taxCertificateDocumentFileId: z.string().trim().max(255).optional(),
  proofOfAddressDocumentFileId: z.string().trim().max(255).optional(),
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
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required.", code: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError) return Response.json({ error: "Complete multi-factor authentication setup before continuing.", code: "MFA_ENROLLMENT_REQUIRED", actionUrl: "/account/security?mfa=setup&returnTo=%2Fseller" }, { status: 403 });
    if (error instanceof MfaVerificationRequiredError) return Response.json({ error: "Verify your multi-factor authentication before continuing.", code: "MFA_VERIFICATION_REQUIRED", actionUrl: "/account/security?mfa=verify&returnTo=%2Fseller" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit seller application." }, { status: 400 });
  }
}
