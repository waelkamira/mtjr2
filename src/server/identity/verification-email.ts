import { createHash, randomBytes } from "node:crypto";
import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/server/identity/normalize-email";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PURPOSE = "EMAIL_VERIFICATION";

function digestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Issues a new single-use challenge only for a pending, unverified account.
 * Only the token digest is stored; raw token is returned to the trusted mail caller.
 */
export async function issueVerificationEmailChallenge(
  emailInput: string,
  now = new Date()
): Promise<{ email: string; token: string } | null> {
  const email = normalizeEmail(emailInput);
  if (!email || email.length > 254) return null;

  const user = await prisma.user.findFirst({
    where: { emailNormalized: email, status: UserStatus.PENDING, emailVerifiedAt: null },
    select: { id: true, email: true }
  });
  if (!user) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.updateMany({
      where: { userId: user.id, purpose: PURPOSE, consumedAt: null },
      data: { consumedAt: now }
    });
    await tx.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: digestToken(token),
        purpose: PURPOSE,
        expiresAt
      }
    });
    await tx.auditLog.create({ data: { actorType: AuditActorType.SYSTEM, action: "identity.email_verification.resent", resource: "user", resourceId: user.id, occurredAt: now } });
  });

  return { email: user.email, token };
}
