import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { verifyPassword } from "@/server/identity/password";

const TOTP_PERIOD_SECONDS = 30;
const MFA_VERIFICATION_TTL_MS = 12 * 60 * 60 * 1000;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type MfaAccessState = {
  enabled: boolean;
  required: boolean;
  platformRequired: boolean;
  privilegedAccountRequired: boolean;
  enrollmentRequired: boolean;
};

function encryptionKey(): Buffer {
  return createHmac("sha256", env.MFA_ENCRYPTION_KEY ?? env.AUTH_SECRET)
    .update("mtjr2:totp-secret-encryption:v1", "utf8")
    .digest();
}

function recoveryCodeHash(code: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`mfa-recovery:${code.replace(/[^A-Fa-f0-9]/gi, "").toUpperCase()}`, "utf8")
    .digest("hex");
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Fa-f0-9]/gi, "").toUpperCase();
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let encoded = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) encoded += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return encoded;
}

function decodeBase32(value: string): Buffer {
  let bits = 0;
  let buffer = 0;
  const decoded: number[] = [];

  for (const character of value.toUpperCase().replace(/=+$/, "")) {
    const digit = BASE32_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error("Stored MFA secret is invalid.");
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      decoded.push((buffer >>> bits) & 255);
    }
  }

  return Buffer.from(decoded);
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("mtjr2:totp:v1", "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final()
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function decryptSecret(ciphertext: string): string {
  const [encodedIv, encodedTag, encodedData, ...extra] = ciphertext.split(".");
  if (!encodedIv || !encodedTag || !encodedData || extra.length > 0) {
    throw new Error("Stored MFA secret is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAAD(Buffer.from("mtjr2:totp:v1", "utf8"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function totpAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function createTotpCode(secret: string, now = new Date()): string {
  const step = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  return totpAtStep(secret, step);
}

export function matchingTotpStep(
  secret: string,
  code: string,
  now: Date,
  lastVerifiedStep: bigint | null
): number | null {
  if (!/^\d{6}$/.test(code)) return null;

  const currentStep = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  for (const step of [currentStep, currentStep - 1, currentStep + 1]) {
    if (step < 0 || (lastVerifiedStep !== null && BigInt(step) <= lastVerifiedStep)) {
      continue;
    }
    const expected = Buffer.from(totpAtStep(secret, step), "ascii");
    const supplied = Buffer.from(code, "ascii");
    if (timingSafeEqual(expected, supplied)) return step;
  }

  return null;
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => randomBytes(8).toString("hex").toUpperCase());
}

function createMfaEnrollmentResult(email: string, secret: string): MfaEnrollmentResult {
  const label = encodeURIComponent(`Mtjr:${email}`);
  const issuer = encodeURIComponent("Mtjr");
  const otpauthUri =
    `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
  return { status: "READY", secret, otpauthUri };
}

export async function getMfaAccessState(
  userId: string,
  now = new Date()
): Promise<MfaAccessState> {
  const [factor, platformGrant, administratorGrant, sellerProfile, storeScopedGrant] = await Promise.all([
    prisma.userTwoFactor.findUnique({
      where: { userId },
      select: { enabledAt: true }
    }),
    prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: {
          permissions: {
            some: { permission: { key: "platform:manage" } }
          }
        }
      },
      select: { id: true }
    }),
    prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: {
          permissions: {
            some: { permission: { key: "users:manage" } }
          }
        }
      },
      select: { id: true }
    }),
    prisma.seller.findUnique({ where: { ownerId: userId }, select: { id: true } }),
    prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        scopeType: "STORE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: {
          permissions: {
            some: { permission: { key: "store:manage" } }
          }
        }
      },
      select: { id: true }
    })
  ]);
  const enabled = factor?.enabledAt !== null && factor?.enabledAt !== undefined;
  const privilegedAccount = Boolean(platformGrant || administratorGrant || sellerProfile || storeScopedGrant);
  const enrollmentRequired = privilegedAccount && !enabled;

  return {
    enabled,
    required: enabled || privilegedAccount,
    platformRequired: Boolean(platformGrant),
    privilegedAccountRequired: privilegedAccount,
    enrollmentRequired
  };
}

export function isMfaVerificationFresh(
  verifiedAt: Date | null,
  now = new Date()
): boolean {
  return verifiedAt !== null &&
    verifiedAt.getTime() > now.getTime() - MFA_VERIFICATION_TTL_MS;
}

export type MfaEnrollmentResult =
  | { status: "READY"; secret: string; otpauthUri: string }
  | { status: "INVALID_PASSWORD" | "PASSWORD_NOT_SET" | "ACCOUNT_INACTIVE" | "ALREADY_ENABLED" };

export async function beginMfaEnrollment(
  userId: string,
  currentPassword: string
): Promise<MfaEnrollmentResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true, status: true }
  });
  if (!user || user.status !== UserStatus.ACTIVE) return { status: "ACCOUNT_INACTIVE" };
  if (!user.passwordHash) return { status: "PASSWORD_NOT_SET" };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { status: "INVALID_PASSWORD" };
  }

  const existing = await prisma.userTwoFactor.findUnique({
    where: { userId },
    select: { enabledAt: true, secretCiphertext: true }
  });
  if (existing?.enabledAt) return { status: "ALREADY_ENABLED" };

  if (existing) {
    return createMfaEnrollmentResult(user.email, decryptSecret(existing.secretCiphertext));
  }

  const secret = encodeBase32(randomBytes(20));
  await prisma.$transaction(async (tx) => {
    await tx.userTwoFactor.upsert({
      where: { userId },
      create: { userId, secretCiphertext: encryptSecret(secret) },
      update: {
        secretCiphertext: encryptSecret(secret),
        enabledAt: null,
        lastVerifiedStep: null
      }
    });
    await tx.userTwoFactorRecoveryCode.deleteMany({ where: { userId } });
  });

  return createMfaEnrollmentResult(user.email, secret);
}

class MfaSessionChangedError extends Error {}

export async function confirmMfaEnrollment(
  userId: string,
  sessionId: string,
  code: string,
  now = new Date()
): Promise<string[] | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const recoveryCodes = generateRecoveryCodes();

  try {
    return await prisma.$transaction(async (tx) => {
      const factor = await tx.userTwoFactor.findUnique({
        where: { userId },
        select: { secretCiphertext: true, enabledAt: true, lastVerifiedStep: true }
      });
      if (!factor || factor.enabledAt) return null;

      const step = matchingTotpStep(
        decryptSecret(factor.secretCiphertext),
        code,
        now,
        factor.lastVerifiedStep
      );
      if (step === null) return null;

      const enabled = await tx.userTwoFactor.updateMany({
        where: {
          userId,
          enabledAt: null,
          OR: [
            { lastVerifiedStep: null },
            { lastVerifiedStep: { lt: BigInt(step) } }
          ]
        },
        data: { enabledAt: now, lastVerifiedStep: BigInt(step) }
      });
      if (enabled.count !== 1) return null;

      await tx.userTwoFactorRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          userId,
          codeHash: recoveryCodeHash(recoveryCode)
        }))
      });
      const session = await tx.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
        data: { mfaVerifiedAt: now }
      });
      if (session.count !== 1) throw new MfaSessionChangedError();

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: userId,
          action: "identity.mfa.enabled",
          resource: "user_mfa",
          resourceId: userId,
          occurredAt: now
        }
      });
      return recoveryCodes;
    });
  } catch (error) {
    if (error instanceof MfaSessionChangedError) return null;
    throw error;
  }
}

export async function verifyMfaSession(
  userId: string,
  sessionId: string,
  code: string,
  now = new Date()
): Promise<boolean> {
  if (code.length > 32 || !code.trim()) return false;

  try {
    return await prisma.$transaction(async (tx) => {
      const factor = await tx.userTwoFactor.findUnique({
        where: { userId },
        select: { secretCiphertext: true, enabledAt: true, lastVerifiedStep: true }
      });
      if (!factor?.enabledAt) return false;

      const step = matchingTotpStep(
        decryptSecret(factor.secretCiphertext),
        code,
        now,
        factor.lastVerifiedStep
      );
      let accepted = false;
      if (step !== null) {
        const consumed = await tx.userTwoFactor.updateMany({
          where: {
            userId,
            enabledAt: { not: null },
            OR: [
              { lastVerifiedStep: null },
              { lastVerifiedStep: { lt: BigInt(step) } }
            ]
          },
          data: { lastVerifiedStep: BigInt(step) }
        });
        accepted = consumed.count === 1;
      } else {
        const normalized = normalizeRecoveryCode(code);
        if (!/^[A-F0-9]{16}$/.test(normalized)) return false;
        const consumed = await tx.userTwoFactorRecoveryCode.updateMany({
          where: {
            userId,
            codeHash: recoveryCodeHash(normalized),
            usedAt: null
          },
          data: { usedAt: now }
        });
        accepted = consumed.count === 1;
      }
      if (!accepted) return false;

      const session = await tx.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
        data: { mfaVerifiedAt: now }
      });
      if (session.count !== 1) throw new MfaSessionChangedError();

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: userId,
          action: "identity.mfa.verified",
          resource: "user_session",
          resourceId: sessionId,
          occurredAt: now,
          metadata: { method: step === null ? "recovery_code" : "totp" }
        }
      });
      return true;
    });
  } catch (error) {
    if (error instanceof MfaSessionChangedError) return false;
    throw error;
  }
}

/** Verify a fresh TOTP code for a ten-minute platform-admin step-up. */
export async function verifyMfaStepUp(
  userId: string,
  sessionId: string,
  code: string,
  now = new Date()
): Promise<boolean> {
  if (!/^\\d{6}$/.test(code)) return false;

  try {
    return await prisma.$transaction(async (tx) => {
      const factor = await tx.userTwoFactor.findUnique({
        where: { userId },
        select: { secretCiphertext: true, enabledAt: true, lastVerifiedStep: true }
      });
      if (!factor?.enabledAt) return false;

      const step = matchingTotpStep(decryptSecret(factor.secretCiphertext), code, now, factor.lastVerifiedStep);
      if (step === null) return false;
      const consumed = await tx.userTwoFactor.updateMany({
        where: {
          userId,
          enabledAt: { not: null },
          OR: [{ lastVerifiedStep: null }, { lastVerifiedStep: { lt: BigInt(step) } }]
        },
        data: { lastVerifiedStep: BigInt(step) }
      });
      if (consumed.count !== 1) return false;

      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      const session = await tx.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
        data: { stepUpVerifiedAt: now, stepUpExpiresAt: expiresAt }
      });
      if (session.count !== 1) throw new MfaSessionChangedError();

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: userId,
          action: "identity.mfa.platform_step_up_verified",
          resource: "user_session",
          resourceId: sessionId,
          occurredAt: now,
          metadata: { method: "totp", expiresAt: expiresAt.toISOString() }
        }
      });
      return true;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof MfaSessionChangedError) return false;
    throw error;
  }
}

export type MfaDisableResult =
  | "DISABLED"
  | "INVALID_PASSWORD"
  | "INVALID_CODE"
  | "PASSWORD_NOT_SET"
  | "MFA_REQUIRED"
  | "SESSION_CHANGED"
  | "NOT_ENABLED";

export async function disableMfa(
  userId: string,
  sessionId: string,
  currentPassword: string,
  code: string,
  now = new Date()
): Promise<MfaDisableResult> {
  const accessState = await getMfaAccessState(userId, now);
  if (accessState.privilegedAccountRequired) return "MFA_REQUIRED";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });
  if (!user?.passwordHash) return "PASSWORD_NOT_SET";
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return "INVALID_PASSWORD";
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const privilegedGrant = await tx.userRoleAssignment.findFirst({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          role: {
            permissions: {
              some: { permission: { key: { in: ["platform:manage", "users:manage", "store:manage"] } } }
            }
          }
        },
        select: { id: true }
      });
      const sellerProfile = await tx.seller.findUnique({ where: { ownerId: userId }, select: { id: true } });
      if (privilegedGrant || sellerProfile) return "MFA_REQUIRED";

      const factor = await tx.userTwoFactor.findUnique({
        where: { userId },
        select: { secretCiphertext: true, enabledAt: true, lastVerifiedStep: true }
      });
      if (!factor?.enabledAt) return "NOT_ENABLED";

      const step = matchingTotpStep(
        decryptSecret(factor.secretCiphertext),
        code,
        now,
        factor.lastVerifiedStep
      );
      let accepted = false;
      if (step !== null) {
        const consumed = await tx.userTwoFactor.updateMany({
          where: {
            userId,
            enabledAt: { not: null },
            OR: [
              { lastVerifiedStep: null },
              { lastVerifiedStep: { lt: BigInt(step) } }
            ]
          },
          data: { lastVerifiedStep: BigInt(step) }
        });
        accepted = consumed.count === 1;
      } else {
        const normalized = normalizeRecoveryCode(code);
        if (/^[A-F0-9]{16}$/.test(normalized)) {
          const consumed = await tx.userTwoFactorRecoveryCode.updateMany({
            where: {
              userId,
              codeHash: recoveryCodeHash(normalized),
              usedAt: null
            },
            data: { usedAt: now }
          });
          accepted = consumed.count === 1;
        }
      }
      if (!accepted) return "INVALID_CODE";

      const session = await tx.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
        data: { mfaVerifiedAt: null }
      });
      if (session.count !== 1) throw new MfaSessionChangedError();

      await tx.userTwoFactor.delete({ where: { userId } });
      await tx.userSession.updateMany({
        where: { userId, mfaVerifiedAt: { not: null }, revokedAt: null },
        data: { mfaVerifiedAt: null }
      });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: userId,
          action: "identity.mfa.disabled",
          resource: "user_mfa",
          resourceId: userId,
          occurredAt: now
        }
      });
      return "DISABLED";
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof MfaSessionChangedError) return "SESSION_CHANGED";
    throw error;
  }
}
