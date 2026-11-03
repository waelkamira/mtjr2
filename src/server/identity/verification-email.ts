import { randomBytes, createHash } from "node:crypto";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/server/identity/normalize-email";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PURPOSE = "EMAIL_VERIFICATION";

export interface VerificationEmailChallenge {
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
}

/** Issue a fresh single-use challenge only for a pending, unverified account. */
export async function issueVerificationEmailChallenge(
  emailInput: string,
  now = new Date()
): Promise<VerificationEmailChallenge | null> {
  const email = normalizeEmail(emailInput);
  if (!email || email.length > 254) return null;

  const user = await prisma.user.findUnique({
    where: { emailNormalized: email },
    select: { id: true, email: true, status: true, emailVerifiedAt: true }
  });
  if (!user || user.status !== UserStatus.PENDING || user.emailVerifiedAt !== null) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.updateMany({
      where: { userId: user.id, purpose: PURPOSE, consumedAt: null },
      data: { consumedAt: now }
    });
    await tx.verificationToken.create({
      data: { userId: user.id, tokenHash, purpose: PURPOSE, expiresAt, createdAt: now }
    });
  });

  return { userId: user.id, email: user.email, token, expiresAt };
}
