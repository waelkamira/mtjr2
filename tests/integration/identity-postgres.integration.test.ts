import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: { getCurrentSession: vi.fn(), requireCurrentSession: vi.fn() }
}));
vi.mock("@/server/identity/current-session", () => ({
  getCurrentSession: sessionMock.getCurrentSession,
  requireCurrentSession: sessionMock.requireCurrentSession
}));

import { prisma } from "@/lib/db/prisma";
import { registerUser, verifyUserEmail } from "@/server/identity/registration";
import { loginWithPassword } from "@/server/identity/login";
import { createPasswordResetChallenge, completePasswordReset } from "@/server/identity/password-reset";
import { verifyPassword } from "@/server/identity/password";
import {
  createUserSession,
  resolveUserSession,
  revokeUserSession
} from "@/server/identity/session";
import { userHasPermission } from "@/server/identity/permission-repository";
import { GET as getAccountProfile, PATCH as patchAccountProfile } from "@/app/api/account/profile/route";
import { createUserAddress, listUserAddresses } from "@/server/account/addresses";
import { listMyFavorites, removeFavorite } from "@/server/wishlist/favorites";
import { listCustomerOrders } from "@/server/orders/orders";
import {
  clearLoginThrottle,
  consumeLoginAttempt
} from "@/server/identity/login-throttle";

const suffix = randomUUID();
const email = `integration-${suffix}@example.test`;
let userId: string | undefined;
const createdUserIds = new Set<string>();

describe("identity PostgreSQL integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionMock.getCurrentSession.mockReset();
    sessionMock.requireCurrentSession.mockReset();
  });

  afterAll(async () => {
    if (createdUserIds.size) {
      await prisma.seller.deleteMany({ where: { ownerId: { in: [...createdUserIds] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    }
    await prisma.$disconnect();
  });

  it("registers, verifies, scopes permissions, and revokes a real database session", async () => {
    const registration = await registerUser({
      email,
      password: "Correct-Horse-Battery-42!",
      displayName: "Integration Buyer",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    userId = registration.userId;
    createdUserIds.add(registration.userId);

    const pending = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { consents: true, verificationTokens: true }
    });

    expect(pending.status).toBe("PENDING");
    expect(pending.consents).toHaveLength(2);
    expect(pending.verificationTokens).toHaveLength(1);
    expect(pending.verificationTokens[0].tokenHash).not.toBe(registration.verificationToken);
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } });
    const customerAssignment = await prisma.userRoleAssignment.findUnique({
      where: {
        userId_roleId_scopeType_scopeId: {
          userId,
          roleId: customerRole.id,
          scopeType: "GLOBAL",
          scopeId: "GLOBAL"
        }
      }
    });
    expect(customerAssignment).not.toBeNull();

    // Concurrent consumers must not both activate the same verification challenge.
    const verificationResults = await Promise.all([
      verifyUserEmail(registration.verificationToken),
      verifyUserEmail(registration.verificationToken)
    ]);
    expect(verificationResults.filter(Boolean)).toHaveLength(1);

    const active = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(active.status).toBe("ACTIVE");
    expect(active.emailVerifiedAt).not.toBeNull();

    const role = await prisma.role.findUniqueOrThrow({
      where: { key: "STORE_MANAGER" }
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: "catalog:manage" }
    });

    await prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        scopeType: "STORE",
        scopeId: `store-${suffix}`
      }
    });

    await expect(
      userHasPermission(userId, {
        permissionKey: "catalog:manage",
        scope: { type: "STORE", id: `store-${suffix}` }
      })
    ).resolves.toBe(true);

    await expect(
      userHasPermission(userId, {
        permissionKey: "catalog:manage",
        scope: { type: "STORE", id: "another-store" }
      })
    ).resolves.toBe(false);

    await expect(
      prisma.userRoleAssignment.create({
        data: {
          userId,
          roleId: role.id,
          scopeType: "STORE",
          scopeId: `store-${suffix}`
        }
      })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(permission.key).toBe("catalog:manage");

    const createdSession = await createUserSession(userId);
    await expect(resolveUserSession(createdSession.token)).resolves.toMatchObject({
      userId
    });

    await expect(revokeUserSession(createdSession.token)).resolves.toBe(true);
    await expect(resolveUserSession(createdSession.token)).resolves.toBeNull();
  });

  it("scopes buyer profile, address, favorites and orders to the authenticated PostgreSQL user", async () => {
    const registration = await registerUser({
      email: "account-scope-" + suffix + "@example.test",
      password: "Correct-Horse-Battery-42!",
      displayName: "Integration Buyer",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    createdUserIds.add(registration.userId);
    await verifyUserEmail(registration.verificationToken);

    const session = { userId: registration.userId };
    sessionMock.getCurrentSession.mockResolvedValue(session);
    sessionMock.requireCurrentSession.mockResolvedValue(session);

    const profileQuery = vi.spyOn(prisma.user, "findUnique");
    const profileResponse = await getAccountProfile();
    expect(profileResponse.status).toBe(200);
    const profileBody = await profileResponse.json();
    expect(profileBody.profile.id).toBe(registration.userId);
    expect(profileQuery).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: registration.userId }
    }));

    const profileUpdate = vi.spyOn(prisma.user, "update");
    const updateResponse = await patchAccountProfile(new Request("http://localhost:3000/api/account/profile", {
      method: "PATCH",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json"
      },
      body: JSON.stringify({ displayName: "Updated Integration Buyer" })
    }));
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()).profile.displayName).toBe("Updated Integration Buyer");
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: registration.userId },
      data: { displayName: "Updated Integration Buyer" }
    }));

    await prisma.country.upsert({
      where: { iso2: "QX" },
      update: { name: "Identity Test Country", isActive: true },
      create: { iso2: "QX", name: "Identity Test Country", isActive: true }
    });
    const address = await createUserAddress({
      countryCode: "QX",
      recipientName: "Integration Buyer",
      phone: "+33612345678",
      line1: "1 Integration Street",
      city: "Paris"
    });
    expect(address.userId).toBe(registration.userId);
    const addresses = await listUserAddresses();
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({ countryCode: "QX", countryName: "Identity Test Country" });

    const favoriteQuery = vi.spyOn(prisma.favorite, "findMany");
    const favorites = await listMyFavorites();
    expect(favorites).toHaveLength(0);
    expect(favoriteQuery).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: registration.userId })
    }));
    const favoriteDelete = vi.spyOn(prisma.favorite, "deleteMany");
    await removeFavorite("missing-product");
    expect(favoriteDelete).toHaveBeenCalledWith({
      where: { userId: registration.userId, productId: "missing-product" }
    });

    const orderQuery = vi.spyOn(prisma.order, "findMany");
    const orders = await listCustomerOrders();
    expect(orders).toHaveLength(0);
    expect(orderQuery).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: registration.userId }
    }));
  });

  it("keeps seller registration pending without granting seller permissions", async () => {
    const sellerRegistration = await registerUser({
      email: "seller-" + suffix + "@example.test",
      password: "Correct-Horse-Battery-42!",
      displayName: "Integration Seller",
      accountType: "SELLER",
      sellerLegalName: "Integration Seller Company",
      sellerDisplayName: "Integration Seller Store",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    createdUserIds.add(sellerRegistration.userId);

    const seller = await prisma.seller.findUniqueOrThrow({
      where: { ownerId: sellerRegistration.userId }
    });
    expect(seller.status).toBe("PENDING");

    const assignments = await prisma.userRoleAssignment.findMany({
      where: { userId: sellerRegistration.userId }
    });
    expect(assignments).toHaveLength(0);
    await expect(
      userHasPermission(sellerRegistration.userId, { permissionKey: "store:manage" })
    ).resolves.toBe(false);
  });

  it("enforces persistent login throttling under concurrent PostgreSQL requests", async () => {
    const throttleEmail = `throttle-${suffix}@example.test`;
    const ipHex = suffix.replaceAll("-", "");
    const trustedIpAddress = `2001:db8:${ipHex.slice(0, 4)}:${ipHex.slice(4, 8)}:${ipHex.slice(8, 12)}:${ipHex.slice(12, 16)}:${ipHex.slice(16, 20)}:${ipHex.slice(20, 24)}`;

    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        consumeLoginAttempt(
          { identifier: throttleEmail, trustedIpAddress },
          new Date("2026-11-03T12:00:00.000Z")
        )
      )
    );

    expect(attempts).toHaveLength(8);
    expect(attempts.some((attempt) => attempt.blocked)).toBe(true);

    await expect(
      consumeLoginAttempt(
        { identifier: throttleEmail, trustedIpAddress },
        new Date("2026-11-03T12:00:01.000Z")
      )
    ).resolves.toEqual({ blocked: true });

    // Successful authentication clears only the identifier/IP pair bucket.
    await clearLoginThrottle(throttleEmail, trustedIpAddress);
    await expect(
      consumeLoginAttempt(
        { identifier: throttleEmail, trustedIpAddress },
        new Date("2026-11-03T12:00:02.000Z")
      )
    ).resolves.toEqual({ blocked: false });
  });

  it("authenticates a verified user, records attempts, and persists a digest-only session", async () => {
    const loginEmail = `login-${suffix}@example.test`;
    const trustedIpAddress = "2001:db8:abcd:1234::42";
    const registration = await registerUser({
      email: loginEmail,
      password: "Correct-Horse-Battery-42!",
      displayName: "Login Integration",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    createdUserIds.add(registration.userId);
    await expect(verifyUserEmail(registration.verificationToken)).resolves.toBe(true);

    const failed = await loginWithPassword({
      email: loginEmail,
      password: "Wrong-Password-000!",
      trustedIpAddress
    });
    expect(failed).toMatchObject({
      authenticated: false,
      reason: "INVALID_CREDENTIALS"
    });

    const authenticated = await loginWithPassword({
      email: loginEmail,
      password: "Correct-Horse-Battery-42!",
      trustedIpAddress,
      userAgent: "mtjr2-postgres-integration"
    });
    expect(authenticated.authenticated).toBe(true);
    if (!authenticated.authenticated) throw new Error("Expected successful login.");

    expect(authenticated.userId).toBe(registration.userId);
    const [attempts, sessions, audit] = await Promise.all([
      prisma.loginAttempt.findMany({
        where: { userId: registration.userId },
        orderBy: { attemptedAt: "asc" }
      }),
      prisma.userSession.findMany({
        where: { userId: registration.userId }
      }),
      prisma.auditLog.findMany({
        where: {
          actorId: registration.userId,
          action: "identity.login.succeeded"
        }
      })
    ]);

    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.succeeded)).toEqual([false, true]);
    expect(attempts.every((attempt) => attempt.identifierHash !== loginEmail)).toBe(true);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(authenticated.session.token);
    expect(sessions[0].tokenHash).toHaveLength(64);
    expect(audit).toHaveLength(1);

    await expect(resolveUserSession(authenticated.session.token)).resolves.toMatchObject({
      userId: registration.userId
    });
    await expect(revokeUserSession(authenticated.session.token)).resolves.toBe(true);
  });

  it("consumes a password reset token once, changes the password, and revokes sessions", async () => {
    const resetEmail = `reset-${suffix}@example.test`;
    const oldPassword = "Correct-Horse-Battery-42!";
    const newPassword = "New-Correct-Horse-Battery-73!";
    const registration = await registerUser({
      email: resetEmail,
      password: oldPassword,
      displayName: "Password Reset Integration",
      accountType: "CUSTOMER",
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    createdUserIds.add(registration.userId);
    await expect(verifyUserEmail(registration.verificationToken)).resolves.toBe(true);

    const activeSession = await createUserSession(registration.userId);
    const challenge = await createPasswordResetChallenge(resetEmail);
    expect(challenge).not.toBeNull();
    if (!challenge) throw new Error("Expected a password reset challenge.");

    const storedToken = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: registration.userId },
      orderBy: { createdAt: "desc" }
    });
    expect(storedToken.tokenHash).not.toBe(challenge.token);
    expect(storedToken.tokenHash).toHaveLength(64);

    await expect(completePasswordReset(challenge.token, newPassword)).resolves.toBe(true);
    await expect(completePasswordReset(challenge.token, newPassword)).resolves.toBe(false);
    await expect(resolveUserSession(activeSession.token)).resolves.toBeNull();

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: registration.userId },
      select: { passwordHash: true }
    });
    expect(updatedUser.passwordHash).not.toBeNull();
    await expect(verifyPassword(newPassword, updatedUser.passwordHash!)).resolves.toBe(true);
    await expect(verifyPassword(oldPassword, updatedUser.passwordHash!)).resolves.toBe(false);

    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: registration.userId,
          action: "identity.password_reset.completed"
        }
      })
    ).resolves.not.toBeNull();
  });

});
