import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/server/identity/password";
import { loginWithPassword } from "@/server/identity/login";
import { completePasswordReset, createPasswordResetChallenge } from "@/server/identity/password-reset";

const barrier = vi.hoisted(() => {
  let verified!: () => void;
  let release!: () => void;
  return {
    verified: new Promise<void>((resolve) => { verified = resolve; }),
    markVerified: () => verified(),
    released: new Promise<void>((resolve) => { release = resolve; }),
    release: () => release()
  };
});

vi.mock("@/server/identity/password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/identity/password")>();
  return { ...actual, verifyPassword: async (...args: Parameters<typeof actual.verifyPassword>) => {
    const result = await actual.verifyPassword(...args);
    barrier.markVerified();
    await barrier.released;
    return result;
  } };
});

let userId: string | undefined;
afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

it("does not create a session when a reset completes after password verification", async () => {
  const email = `race-${randomUUID()}@example.test`;
  const user = await prisma.user.create({ data: {
    email, emailNormalized: email, status: "ACTIVE", emailVerifiedAt: new Date(),
    passwordHash: await hashPassword("Old-password-123!")
  } });
  userId = user.id;
  const challenge = await createPasswordResetChallenge(email);
  expect(challenge).not.toBeNull();
  const login = loginWithPassword({ email, password: "Old-password-123!", trustedIpAddress: "127.0.0.1" });
  await barrier.verified;
  try {
    expect(await completePasswordReset(challenge!.token, "New-password-456!")).toBe(true);
  } finally {
    barrier.release();
  }
  expect(await login).toMatchObject({ authenticated: false, reason: "INVALID_CREDENTIALS" });
  expect(await prisma.userSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
});
