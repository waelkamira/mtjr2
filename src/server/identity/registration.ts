import { AuditActorType, ConsentType, Prisma, SellerStatus, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/server/identity/password";
import { normalizeEmail } from "@/server/identity/normalize-email";

const registrationInputSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  accountType: z.enum(["CUSTOMER", "SELLER"]),
  sellerLegalName: z.string().trim().min(2).max(160).optional(),
  sellerDisplayName: z.string().trim().min(2).max(80).optional(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true)
}).superRefine((value, context) => {
  if (value.accountType === "SELLER" && (!value.sellerLegalName || !value.sellerDisplayName)) {
    context.addIssue({ code: "custom", message: "Seller business name and public store name are required.", path: ["sellerLegalName"] });
  }
});

export type RegistrationInput = z.input<typeof registrationInputSchema>;

export class IdentityConflictError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "IdentityConflictError";
  }
}

export interface RegistrationResult {
  userId: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Creates an active account without requiring email verification.
 */
export async function registerUser(
  input: RegistrationInput,
  now = new Date()
): Promise<RegistrationResult> {
  const parsed = registrationInputSchema.parse(input);
  const emailNormalized = normalizeEmail(parsed.email);

  if (!emailNormalized) {
    throw new Error("A valid email address is required.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailNormalized },
        { emailNormalized }
      ]
    },
    select: { id: true }
  });
  if (existingUser) throw new IdentityConflictError();

  const passwordHash = await hashPassword(parsed.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: emailNormalized,
          emailNormalized,
          passwordHash,
          displayName: parsed.displayName,
          status: UserStatus.ACTIVE
        },
        select: { id: true }
      });

      if (parsed.accountType === "SELLER") {
        await tx.seller.create({ data: { ownerId: createdUser.id, legalName: parsed.sellerLegalName, displayName: parsed.sellerDisplayName, status: SellerStatus.PENDING } });
      }

      await tx.userConsent.createMany({
        data: [
          {
            userId: createdUser.id,
            type: ConsentType.TERMS_OF_SERVICE,
            version: "v1",
            granted: true,
            capturedAt: now,
            source: "registration"
          },
          {
            userId: createdUser.id,
            type: ConsentType.PRIVACY_POLICY,
            version: "v1",
            granted: true,
            capturedAt: now,
            source: "registration"
          }
        ]
      });

      await tx.auditLog.create({ data: { actorType: AuditActorType.SYSTEM, action: "identity.registration.created", resource: "user", resourceId: createdUser.id, occurredAt: now, metadata: { emailVerificationRequired: false } } });

      return createdUser;
    });

    return { userId: user.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new IdentityConflictError();
    throw error;
  }
}
