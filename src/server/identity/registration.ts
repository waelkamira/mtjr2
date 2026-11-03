import { randomBytes, createHash } from "node:crypto";
import { ConsentType, Prisma, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/server/identity/password";
import { normalizeEmail } from "@/server/identity/normalize-email";

const registrationInputSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true)
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
  /** Pass only to a trusted email-delivery adapter; never return from an API. */
  verificationToken: string;
  verificationExpiresAt: Date;
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_PURPOSE = "EMAIL_VERIFICATION";

function createVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

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
 * Creates a pending account and a single-use email-verification challenge.
 * The raw challenge is returned only to the trusted caller that sends email.
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

  const passwordHash = await hashPassword(parsed.password);
  const verificationToken = createVerificationToken();
  const verificationExpiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: emailNormalized,
          emailNormalized,
          passwordHash,
          displayName: parsed.displayName,
          status: UserStatus.PENDING
        },
        select: { id: true }
      });

      await tx.verificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash: digestToken(verificationToken),
          purpose: VERIFICATION_PURPOSE,
          expiresAt: verificationExpiresAt
        }
      });

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

      return createdUser;
    });

    return {
      userId: user.id,
      verificationToken,
      verificationExpiresAt
    };
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

    return activated.count === 1;
  });
}
