import "server-only";

import {
  createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual
} from "node:crypto";
import { AuditActorType } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/server/identity/password";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;

export class MfaConfigurationError extends Error {
  constructor() { super("MFA_ENCRYPTION_KEY must be configured before MFA enrollment."); this.name = "MfaConfigurationError"; }
}
export class MfaStateConflictError extends Error {
  constructor(message: string) { super(message); this.name = "MfaStateConflictError"; }
}

function encryptionKey(explicit?: Buffer): Buffer {
  if (explicit) {
    if (explicit.length !== 32) throw new MfaConfigurationError();
    return explicit;
  }
  const key = env.MFA_ENCRYPTION_KEY ? Buffer.from(env.MFA_ENCRYPTION_KEY, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new MfaConfigurationError();
  return key;
}

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error("Invalid Base32 secret.");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function generateTotpCode(secret: string, step: number): string {
  if (!Number.isSafeInteger(step) || step < 0) throw new Error("Invalid TOTP time step.");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function findMatchingTotpStep(
  secret: string,
  code: string,
  now: Date,
  lastUsedStep: number | null
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  for (const step of [current, current - 1, current + 1]) {
    if (step < 0 || (lastUsedStep !== null && step <= lastUsedStep)) continue;
    const expected = Buffer.from(generateTotpCode(secret, step));
    const supplied = Buffer.from(code);
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) return step;
  }
  return null;
}

export function encryptMfaSecret(secret: string, explicitKey?: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(explicitKey), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    secretCiphertext: ciphertext.toString("base64"),
    secretIv: iv.toString("base64"),
    secretTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptMfaSecret(
  record: { secretCiphertext: string; secretIv: string; secretTag: string },
  explicitKey?: Buffer
): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(explicitKey),
    Buffer.from(record.secretIv, "base64")
  );
  decipher.setAuthTag(Buffer.from(record.secretTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.secretCiphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[\s-]/g, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function generateRecoveryCodes() {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomBytes(10).toString("hex").toUpperCase());
  return { codes, records: codes.map(code => ({ codeHash: hashRecoveryCode(code) })) };
}

export async function getMfaStatus(userId: string) {
  const authenticator = await prisma.userMfaAuthenticator.findUnique({
    where: { userId },
    select: { enabledAt: true }
  });
  const recoveryCodesRemaining = await prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
  return {
    enabled: Boolean(authenticator?.enabledAt),
    enrollmentPending: Boolean(authenticator && !authenticator.enabledAt),
    recoveryCodesRemaining
  };
}

export async function createMfaEnrollment(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true, emailVerifiedAt: true, passwordHash: true }
  });
  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
    throw new MfaStateConflictError("An active, email-verified account is required.");
  }
  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new MfaStateConflictError("Confirm your current password before enrolling MFA.");
  }
  const secret = generateTotpSecret();
  const encrypted = encryptMfaSecret(secret);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const existing = await tx.userMfaAuthenticator.findUnique({ where: { userId }, select: { enabledAt: true } });
    if (existing?.enabledAt) throw new MfaStateConflictError("MFA is already enabled.");
    await tx.userMfaAuthenticator.upsert({
      where: { userId },
      create: { userId, ...encrypted },
      update: { ...encrypted, enabledAt: null, lastUsedStep: null }
    });
  });
  const label = encodeURIComponent(`Matjar:${user.email}`);
  const issuer = encodeURIComponent("Matjar");
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { secret, otpauthUrl };
}

export async function confirmMfaEnrollment(userId: string, code: string, now = new Date()) {
  const pending = await prisma.userMfaAuthenticator.findUnique({ where: { userId } });
  if (!pending || pending.enabledAt) throw new MfaStateConflictError("No pending MFA enrollment exists.");
  const secret = decryptMfaSecret(pending);
  const step = findMatchingTotpStep(secret, code, now, pending.lastUsedStep);
  if (step === null) throw new MfaStateConflictError("The verification code is invalid or expired.");
  const recovery = generateRecoveryCodes();
  return prisma.$transaction(async tx => {
    const enabled = await tx.userMfaAuthenticator.updateMany({
      where: { id: pending.id, enabledAt: null, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
      data: { enabledAt: now, lastUsedStep: step }
    });
    if (enabled.count !== 1) throw new MfaStateConflictError("The enrollment code was already used.");
    await tx.mfaRecoveryCode.createMany({
      data: recovery.records.map(record => ({ userId, codeHash: record.codeHash }))
    });
    await tx.auditLog.create({
      data: { actorType: AuditActorType.USER, actorId: userId, action: "identity.mfa.enabled", resource: "user", resourceId: userId, occurredAt: now }
    });
    return { enabled: true, recoveryCodes: recovery.codes };
  });
}

export async function verifyMfaProof(userId: string, code: string, now = new Date()): Promise<boolean> {
  const authenticator = await prisma.userMfaAuthenticator.findUnique({ where: { userId } });
  if (!authenticator?.enabledAt) return false;
  const secret = decryptMfaSecret(authenticator);
  const step = findMatchingTotpStep(secret, code.trim(), now, authenticator.lastUsedStep);
  if (step !== null) {
    const updated = await prisma.userMfaAuthenticator.updateMany({
      where: { id: authenticator.id, enabledAt: { not: null }, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
      data: { lastUsedStep: step }
    });
    if (updated.count === 1) return true;
  }
  const recoveryHash = hashRecoveryCode(code);
  const consumed = await prisma.mfaRecoveryCode.updateMany({
    where: { userId, codeHash: recoveryHash, usedAt: null },
    data: { usedAt: now }
  });
  return consumed.count === 1;
}

export async function verifyMfaStepUp(sessionId: string, userId: string, code: string, now = new Date()): Promise<boolean> {
  if (!(await verifyMfaProof(userId, code, now))) return false;
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const updated = await prisma.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
    data: { stepUpVerifiedAt: now, stepUpExpiresAt: expiresAt }
  });
  if (updated.count !== 1) return false;
  await prisma.auditLog.create({
    data: { actorType: AuditActorType.USER, actorId: userId, action: "identity.mfa.step_up.succeeded", resource: "user_session", resourceId: sessionId, occurredAt: now }
  });
  return true;
}


export async function regenerateMfaRecoveryCodes(userId: string, proof: string, now = new Date()) {
  if (!(await verifyMfaProof(userId, proof, now))) {
    throw new MfaStateConflictError("The MFA verification code is invalid or already used.");
  }
  const recovery = generateRecoveryCodes();
  await prisma.$transaction(async tx => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({
      data: recovery.records.map(record => ({ userId, codeHash: record.codeHash }))
    });
    await tx.auditLog.create({
      data: { actorType: AuditActorType.USER, actorId: userId, action: "identity.mfa.recovery_codes.regenerated", resource: "user", resourceId: userId, occurredAt: now }
    });
  });
  return recovery.codes;
}

export async function disableMfa(
  userId: string,
  currentPassword: string,
  proof: string,
  now = new Date()
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new MfaStateConflictError("The current password is incorrect.");
  }
  if (!(await verifyMfaProof(userId, proof, now))) {
    throw new MfaStateConflictError("The MFA verification code is invalid or already used.");
  }
  await prisma.$transaction(async tx => {
    // Serialize MFA disable with privilege approval/bootstrap account-row locks.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const assignments = await tx.userRoleAssignment.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } }
    });
    const hasPlatformManagement = assignments.some(assignment =>
      assignment.role.permissions.some(({ permission }) => permission.key === "platform:manage")
    );
    if (hasPlatformManagement) {
      throw new MfaStateConflictError("MFA cannot be disabled while platform-wide privileges are assigned.");
    }
    await tx.userMfaAuthenticator.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { stepUpVerifiedAt: null, stepUpExpiresAt: null }
    });
    await tx.auditLog.create({
      data: { actorType: AuditActorType.USER, actorId: userId, action: "identity.mfa.disabled", resource: "user", resourceId: userId, occurredAt: now }
    });
  });
  return true;
}
