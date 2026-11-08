import { createHash } from "node:crypto";
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

const VERIFICATION_PURPOSE = "EMAIL_VERIFICATION";

function digestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Creates an active account immediately after the caller has verified the
 * registration challenge. Email verification is intentionally not required.
 * Seller applications remain pending and receive no seller permissions.
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

      if (parsed.accountType === "CUSTOMER") {
        const customerRole = await tx.role.findUnique({
          where: { key: "CUSTOMER" },
          select: { id: true }
        });
        if (!customerRole) throw new Error("CUSTOMER role is missing; run the identity seed before registering customers.");
        await tx.userRoleAssignment.create({
          data: { userId: createdUser.id, roleId: customerRole.id, scopeType: "GLOBAL", scopeId: "GLOBAL" }
        });
      }

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

/**
 * Consumes a verification challenge exactly once and activates its account.
 * Invalid, expired, already-used, or wrong-purpose tokens fail closed.
 */
export async function verifyUserEmail(
  token: string | null | undefined,
  now = new Date()
): Promise<boolean> {
  if (!token || token.length !== 43) return false;

  return prisma.$transaction(async (tx) => {
    const challenge = await tx.verificationToken.findUnique({
      where: { tokenHash: digestToken(token) },
      select: {
        id: true,
        userId: true,
        purpose: true,
        expiresAt: true,
        consumedAt: true
      }
    });

    if (
      !challenge ||
      challenge.purpose !== VERIFICATION_PURPOSE ||
      challenge.consumedAt !== null ||
      challenge.expiresAt.getTime() <= now.getTime()
    ) {
      return false;
    }

    const consumed = await tx.verificationToken.updateMany({
      where: {
        id: challenge.id,
        purpose: VERIFICATION_PURPOSE,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      data: { consumedAt: now }
    });

    if (consumed.count !== 1) return false;

    // A valid token must not reactivate a suspended/disabled account. The
    // status predicate also makes concurrent account-state changes fail closed.
    const activated = await tx.user.updateMany({
      where: {
        id: challenge.userId,
        status: UserStatus.PENDING
      },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now
      }
    });

    if (activated.count !== 1) return false;
    await tx.auditLog.create({ data: { actorType: AuditActorType.SYSTEM, action: "identity.email_verification.completed", resource: "user", resourceId: challenge.userId, occurredAt: now } });
    return true;
  });
}
