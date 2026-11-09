import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AuditActorType, PaymentProviderConfigStatus, PaymentProviderEnvironment, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";
import { userHasPermission } from "@/server/identity/permission-repository";
import { PermissionDeniedError } from "@/server/identity/access-errors";
import { PaymentProviderConfigurationError } from "@/server/payments/providers/types";

const providerKeySchema = z.enum(["stripe", "paypal"]);
const countrySchema = z.array(z.string().regex(/^[A-Z]{2}$/)).max(250).transform((values) => [...new Set(values)]);
const currencySchema = z.array(z.string().regex(/^[A-Z]{3}$/)).max(200).transform((values) => [...new Set(values)]);
const methodsSchema = z.array(z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/)).max(40).transform((values) => [...new Set(values)]);

const createSchema = z.object({
  providerKey: providerKeySchema,
  environment: z.nativeEnum(PaymentProviderEnvironment),
  displayName: z.string().trim().min(2).max(120),
  credentials: z.record(z.string(), z.string().trim().min(1).max(4096)),
  supportedCountries: countrySchema.default([]),
  supportedCurrencies: currencySchema.default([]),
  enabledPaymentMethods: methodsSchema.default([]),
  sortOrder: z.number().int().min(0).max(10_000).default(0)
}).strict();

const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  credentials: z.record(z.string(), z.string().trim().min(1).max(4096)).optional(),
  supportedCountries: countrySchema.optional(),
  supportedCurrencies: currencySchema.optional(),
  enabledPaymentMethods: methodsSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional()
}).strict();

type ProviderCredentials = Record<string, string>;

async function requireProviderManagement() {
  const actor = await requirePlatformManagement();
  if (!(await userHasPermission(actor.userId, { permissionKey: "payment.providers.manage" }))) {
    throw new PermissionDeniedError();
  }
  return actor;
}

function encryptionKeyRing() {
  const keys = new Map<number, Buffer>();
  // Backward-compatible v1 source remains readable during a gradual migration.
  if (env.PAYMENT_PROVIDER_ENCRYPTION_KEY) {
    keys.set(1, Buffer.from(env.PAYMENT_PROVIDER_ENCRYPTION_KEY, "hex"));
  }
  if (env.PAYMENT_PROVIDER_ENCRYPTION_KEYS) {
    const parsed = JSON.parse(env.PAYMENT_PROVIDER_ENCRYPTION_KEYS) as Record<string, string>;
    for (const [version, value] of Object.entries(parsed)) {
      if (!Number.isSafeInteger(Number(version)) || Number(version) < 1 || String(Number(version)) !== version || !/^[a-fA-F0-9]{64}$/.test(value)) {
        throw new Error("Provider credential key ring contains an invalid entry.");
      }
      keys.set(Number(version), Buffer.from(value, "hex"));
    }
  }
  if (!keys.has(env.PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION)) {
    throw new PaymentProviderConfigurationError("The active provider credential encryption key version is missing from the configured key ring.");
  }
  return keys;
}

function encryptCredentials(credentials: ProviderCredentials) {
  const version = env.PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION;
  const key = encryptionKeyRing().get(version)!;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    keyVersion: version,
    encrypted: [`v${version}`, nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
  };
}

function decryptCredentials(value: string, keyVersion: number): ProviderCredentials {
  const key = encryptionKeyRing().get(keyVersion);
  if (!key) throw new Error(`Provider credential key version ${keyVersion} is unavailable; restore it before processing payments.`);
  const [version, noncePart, tagPart, ciphertextPart, extra] = value.split(".");
  if (version !== `v${keyVersion}` || !noncePart || !tagPart || !ciphertextPart || extra !== undefined) {
    throw new PaymentProviderConfigurationError("Stored provider credentials have an invalid encrypted envelope.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(noncePart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final()
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new PaymentProviderConfigurationError("Stored provider credentials are invalid.");
    }
    return parsed as ProviderCredentials;
  } catch (error) {
    if (error instanceof PaymentProviderConfigurationError) throw error;
    throw new PaymentProviderConfigurationError("Stored provider credentials could not be decrypted. Restore the matching key version and verify database integrity.");
  }
}

export function decryptPaymentProviderCredentials(value: string, keyVersion: number): ProviderCredentials {
  return decryptCredentials(value, keyVersion);
}

export async function getActivePaymentProviderRuntimeConfig(
  providerKey: "stripe" | "paypal",
  environment: PaymentProviderEnvironment,
  currencyCode: string,
  countryCode?: string | null
) {
  const config = await prisma.paymentProviderConfig.findUnique({
    where: { providerKey_environment: { providerKey, environment } }
  });
  if (!config) return { managed: false as const, config: null };
  if (config.status !== PaymentProviderConfigStatus.ACTIVE || !config.encryptedCredentials) {
    return { managed: true as const, config: null };
  }
  if (config.supportedCurrencies.length && !config.supportedCurrencies.includes(currencyCode)) {
    return { managed: true as const, config: null };
  }
  const adapterMethod = providerKey === "stripe" ? "card" : "paypal";
  if (config.enabledPaymentMethods.length && !config.enabledPaymentMethods.includes(adapterMethod)) {
    return { managed: true as const, config: null };
  }
  if (config.supportedCountries.length && (!countryCode || !config.supportedCountries.includes(countryCode))) {
    return { managed: true as const, config: null };
  }
  return {
    managed: true as const,
    config: {
      id: config.id,
      providerKey: config.providerKey as "stripe" | "paypal",
      environment: config.environment,
      encryptedCredentials: config.encryptedCredentials,
      credentialsKeyVersion: config.credentialsKeyVersion,
      credentials: decryptCredentials(config.encryptedCredentials, config.credentialsKeyVersion)
    }
  };
}

export async function getActiveProviderCredentialsForWebhook(
  providerKey: "stripe" | "paypal",
  environment: PaymentProviderEnvironment
) {
  const config = await prisma.paymentProviderConfig.findUnique({
    where: { providerKey_environment: { providerKey, environment } },
    select: { status: true, encryptedCredentials: true, credentialsKeyVersion: true }
  });
  if (!config || config.status !== PaymentProviderConfigStatus.ACTIVE || !config.encryptedCredentials) return null;
  return decryptCredentials(config.encryptedCredentials, config.credentialsKeyVersion);
}

export async function getPaymentProviderRuntimeSnapshot(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      provider: true,
      providerEnvironment: true,
      encryptedProviderCredentials: true,
      providerCredentialsKeyVersion: true
    }
  });
  if (!payment?.encryptedProviderCredentials || !payment.providerCredentialsKeyVersion || !payment.providerEnvironment) return null;
  return {
    provider: payment.provider,
    environment: payment.providerEnvironment,
    credentials: decryptCredentials(payment.encryptedProviderCredentials, payment.providerCredentialsKeyVersion)
  };
}

/**
 * Re-encrypts every stored provider secret with the configured active key.
 * Keep every old key in PAYMENT_PROVIDER_ENCRYPTION_KEYS until this finishes
 * successfully and the resulting counts are confirmed to be zero.
 */
export async function rotateStoredPaymentProviderCredentials() {
  const actor = await requireProviderManagement();
  const activeVersion = env.PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION;
  // Fail before touching data if the active key is absent or malformed.
  encryptionKeyRing().get(activeVersion) ?? (() => { throw new Error("The active provider encryption key is unavailable."); })();
  const malformedSnapshots = await prisma.payment.count({
    where: {
      encryptedProviderCredentials: { not: null },
      OR: [
        { providerCredentialsKeyVersion: null },
        { providerEnvironment: null },
        { providerConfigId: null }
      ]
    }
  });
  if (malformedSnapshots) {
    throw new Error("Some payment credential snapshots are incomplete. Reconcile them before rotating encryption keys.");
  }

  let configCount = 0;
  let paymentCount = 0;
  const sourceVersions = new Set<number>();
  const maxRowsPerRun = 100;
  let configScanned = 0;

  while (configScanned < maxRowsPerRun) {
    const batch = await prisma.paymentProviderConfig.findMany({
      where: { encryptedCredentials: { not: null }, credentialsKeyVersion: { not: activeVersion } },
      orderBy: { id: "asc" },
      take: Math.min(50, maxRowsPerRun - configScanned),
      select: { id: true, encryptedCredentials: true, credentialsKeyVersion: true }
    });
    if (!batch.length) break;
    configScanned += batch.length;
    let progressed = 0;
    for (const row of batch) {
      if (!row.encryptedCredentials) continue;
      sourceVersions.add(row.credentialsKeyVersion);
      const encrypted = encryptCredentials(decryptCredentials(row.encryptedCredentials, row.credentialsKeyVersion));
      const changed = await prisma.paymentProviderConfig.updateMany({
        where: { id: row.id, credentialsKeyVersion: row.credentialsKeyVersion },
        data: { encryptedCredentials: encrypted.encrypted, credentialsKeyVersion: encrypted.keyVersion }
      });
      configCount += changed.count;
      progressed += changed.count;
    }
    if (!progressed) break;
  }

  let paymentScanned = 0;
  while (paymentScanned < maxRowsPerRun) {
    const batch = await prisma.payment.findMany({
      where: {
        encryptedProviderCredentials: { not: null },
        providerCredentialsKeyVersion: { not: activeVersion }
      },
      orderBy: { id: "asc" },
      take: Math.min(50, maxRowsPerRun - paymentScanned),
      select: { id: true, encryptedProviderCredentials: true, providerCredentialsKeyVersion: true }
    });
    if (!batch.length) break;
    paymentScanned += batch.length;
    let progressed = 0;
    for (const row of batch) {
      if (!row.encryptedProviderCredentials || row.providerCredentialsKeyVersion === null) continue;
      sourceVersions.add(row.providerCredentialsKeyVersion);
      const encrypted = encryptCredentials(decryptCredentials(row.encryptedProviderCredentials, row.providerCredentialsKeyVersion));
      const changed = await prisma.payment.updateMany({
        where: { id: row.id, providerCredentialsKeyVersion: row.providerCredentialsKeyVersion },
        data: {
          encryptedProviderCredentials: encrypted.encrypted,
          providerCredentialsKeyVersion: encrypted.keyVersion
        }
      });
      paymentCount += changed.count;
      progressed += changed.count;
    }
    if (!progressed) break;
  }

  const [remainingConfigs, remainingPayments] = await Promise.all([
    prisma.paymentProviderConfig.count({
      where: { encryptedCredentials: { not: null }, credentialsKeyVersion: { not: activeVersion } }
    }),
    prisma.payment.count({
      where: { encryptedProviderCredentials: { not: null }, providerCredentialsKeyVersion: { not: activeVersion } }
    })
  ]);

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.USER,
      actorId: actor.userId,
      action: "payment.provider.credentials_reencrypted",
      resource: "payment_provider_credential_vault",
      resourceId: "GLOBAL",
      scopeType: "GLOBAL",
      scopeId: "GLOBAL",
      metadata: {
        activeKeyVersion: activeVersion,
        sourceKeyVersions: [...sourceVersions].sort((a, b) => a - b),
        providerConfigsReencrypted: configCount,
        paymentSnapshotsReencrypted: paymentCount,
        remainingProviderConfigs: remainingConfigs,
        remainingPaymentSnapshots: remainingPayments
      }
    }
  });

  return {
    activeKeyVersion: activeVersion,
    providerConfigsReencrypted: configCount,
    paymentSnapshotsReencrypted: paymentCount,
    remainingProviderConfigs: remainingConfigs,
    remainingPaymentSnapshots: remainingPayments,
    complete: remainingConfigs === 0 && remainingPayments === 0
  };
}

function validateCredentials(
  providerKey: "stripe" | "paypal",
  credentials: ProviderCredentials,
  environment: PaymentProviderEnvironment
) {
  const keys = Object.keys(credentials).sort();
  if (providerKey === "stripe") {
    if (keys.join(",") !== "secretKey,webhookSecret") throw new Error("Stripe requires exactly secretKey and webhookSecret.");
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(credentials.secretKey)) throw new Error("Stripe secret key format is invalid.");
    if (!/^whsec_[A-Za-z0-9]+$/.test(credentials.webhookSecret)) throw new Error("Stripe webhook secret format is invalid.");
    if (environment === PaymentProviderEnvironment.TEST && !credentials.secretKey.startsWith("sk_test_")) throw new Error("A test environment requires a Stripe test secret key.");
    if (environment === PaymentProviderEnvironment.LIVE && !credentials.secretKey.startsWith("sk_live_")) throw new Error("A live environment requires a Stripe live secret key.");
  } else {
    if (keys.join(",") !== "clientId,clientSecret,webhookId") throw new Error("PayPal requires exactly clientId, clientSecret and webhookId.");
    if (!/^[A-Za-z0-9._-]{8,256}$/.test(credentials.clientId)) throw new Error("PayPal client ID format is invalid.");
    if (credentials.clientSecret.length < 8) throw new Error("PayPal client secret format is invalid.");
    if (!/^[A-Za-z0-9._-]{8,128}$/.test(credentials.webhookId)) throw new Error("PayPal webhook ID format is invalid.");
  }
}

function validatePaymentMethods(providerKey: "stripe" | "paypal", methods: string[]) {
  const supported = providerKey === "stripe" ? new Set(["card"]) : new Set(["paypal"]);
  const unsupported = methods.filter((method) => !supported.has(method));
  if (unsupported.length) {
    throw new Error(`The ${providerKey} adapter does not support these configured payment methods: ${unsupported.join(", ")}.`);
  }
}

function fingerprint(credentials: ProviderCredentials) {
  const identifier = credentials.clientId ?? credentials.secretKey ?? "";
  return createHash("sha256").update(identifier).digest("hex").slice(0, 12);
}

function publicConfig(config: {
  id: string; providerKey: string; displayName: string; environment: PaymentProviderEnvironment;
  status: PaymentProviderConfigStatus; credentialFingerprint: string | null;
  supportedCountries: string[]; supportedCurrencies: string[]; enabledPaymentMethods: string[];
  sortOrder: number; lastVerifiedAt: Date | null; lastVerificationStatus: string | null;
  lastVerificationMessage: string | null; createdAt: Date; updatedAt: Date; archivedAt: Date | null;
  encryptedCredentials: string | null;
}) {
  return {
    id: config.id, providerKey: config.providerKey, displayName: config.displayName,
    environment: config.environment, status: config.status,
    credentialsConfigured: Boolean(config.encryptedCredentials),
    credentialFingerprint: config.credentialFingerprint,
    supportedCountries: config.supportedCountries, supportedCurrencies: config.supportedCurrencies,
    enabledPaymentMethods: config.enabledPaymentMethods, sortOrder: config.sortOrder,
    lastVerifiedAt: config.lastVerifiedAt?.toISOString() ?? null,
    lastVerificationStatus: config.lastVerificationStatus,
    lastVerificationMessage: config.lastVerificationMessage,
    createdAt: config.createdAt.toISOString(), updatedAt: config.updatedAt.toISOString(),
    archivedAt: config.archivedAt?.toISOString() ?? null
  };
}

export async function listPaymentProviderConfigs() {
  await requireProviderManagement();
  const items = await prisma.paymentProviderConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { providerKey: "asc" }, { environment: "asc" }]
  });
  return { items: items.map(publicConfig) };
}

export async function createPaymentProviderConfig(input: unknown) {
  const actor = await requireProviderManagement();
  const parsed = createSchema.parse(input);
  validateCredentials(parsed.providerKey, parsed.credentials, parsed.environment);
  validatePaymentMethods(parsed.providerKey, parsed.enabledPaymentMethods);
  const encrypted = encryptCredentials(parsed.credentials);
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.paymentProviderConfig.create({
      data: {
        providerKey: parsed.providerKey, displayName: parsed.displayName,
        environment: parsed.environment, status: PaymentProviderConfigStatus.CONFIGURED,
        encryptedCredentials: encrypted.encrypted, credentialsKeyVersion: encrypted.keyVersion,
        credentialFingerprint: fingerprint(parsed.credentials),
        supportedCountries: parsed.supportedCountries, supportedCurrencies: parsed.supportedCurrencies,
        enabledPaymentMethods: parsed.enabledPaymentMethods, sortOrder: parsed.sortOrder
      }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "payment.provider.created", resource: "payment_provider_config", resourceId: item.id,
        scopeType: "GLOBAL", scopeId: "GLOBAL",
        metadata: {
          providerKey: item.providerKey, environment: item.environment, status: item.status,
          credentialFingerprint: item.credentialFingerprint,
          supportedCountries: item.supportedCountries, supportedCurrencies: item.supportedCurrencies,
          enabledPaymentMethods: item.enabledPaymentMethods
        }
      }
    });
    return item;
  });
  return publicConfig(created);
}

export async function updatePaymentProviderConfig(id: string, input: unknown) {
  const actor = await requireProviderManagement();
  const configId = z.string().trim().min(1).max(128).parse(id);
  const parsed = updateSchema.parse(input);
  const existing = await prisma.paymentProviderConfig.findUnique({ where: { id: configId } });
  if (!existing || existing.status === PaymentProviderConfigStatus.ARCHIVED) throw new Error("Payment provider configuration was not found.");
  if (parsed.enabledPaymentMethods) validatePaymentMethods(existing.providerKey as "stripe" | "paypal", parsed.enabledPaymentMethods);

  let encryptedCredentials: string | undefined;
  let credentialFingerprint = existing.credentialFingerprint;
  if (parsed.credentials) {
    validateCredentials(existing.providerKey as "stripe" | "paypal", parsed.credentials, existing.environment);
    const encrypted = encryptCredentials(parsed.credentials);
    encryptedCredentials = encrypted.encrypted;
    credentialFingerprint = fingerprint(parsed.credentials);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.paymentProviderConfig.update({
      where: { id: configId },
      data: {
        ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
        ...(parsed.supportedCountries !== undefined ? { supportedCountries: parsed.supportedCountries } : {}),
        ...(parsed.supportedCurrencies !== undefined ? { supportedCurrencies: parsed.supportedCurrencies } : {}),
        ...(parsed.enabledPaymentMethods !== undefined ? { enabledPaymentMethods: parsed.enabledPaymentMethods } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.credentials ? {
          encryptedCredentials, credentialsKeyVersion: env.PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION, credentialFingerprint,
          status: PaymentProviderConfigStatus.CONFIGURED,
          lastVerificationStatus: null, lastVerificationMessage: null, lastVerifiedAt: null
        } : {})
      }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: parsed.credentials ? "payment.provider.credentials_replaced" : "payment.provider.updated",
        resource: "payment_provider_config", resourceId: configId,
        scopeType: "GLOBAL", scopeId: "GLOBAL",
        metadata: {
          changedFields: Object.keys(parsed).filter((key) => key !== "credentials"),
          credentialsReplaced: Boolean(parsed.credentials), credentialFingerprint,
          environment: existing.environment, providerKey: existing.providerKey
        }
      }
    });
    return item;
  });
  return publicConfig(updated);
}

async function verifyStripe(credentials: ProviderCredentials) {
  const response = await fetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: "Bearer " + credentials.secretKey },
    cache: "no-store", signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error("Stripe rejected the API credential. Check the key and its mode.");
  const account = await response.json() as { id?: string };
  if (!account.id) throw new Error("Stripe did not return an account identity.");
  return "Stripe API credential accepted; webhook signing secret format checked. Webhook delivery is not simulated.";
}

async function verifyPayPal(credentials: ProviderCredentials, environment: PaymentProviderEnvironment) {
  const baseUrl = environment === PaymentProviderEnvironment.LIVE
    ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const basic = Buffer.from(credentials.clientId + ":" + credentials.clientSecret).toString("base64");
  const tokenResponse = await fetch(baseUrl + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials", cache: "no-store", signal: AbortSignal.timeout(15_000)
  });
  const tokenData = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenResponse.ok || !tokenData?.access_token) throw new Error("PayPal rejected the API credentials for the selected environment.");
  const webhookResponse = await fetch(baseUrl + "/v1/notifications/webhooks/" + encodeURIComponent(credentials.webhookId), {
    headers: { Authorization: "Bearer " + tokenData.access_token },
    cache: "no-store", signal: AbortSignal.timeout(15_000)
  });
  if (!webhookResponse.ok) throw new Error("PayPal credentials are valid, but the configured webhook ID could not be verified in this environment.");
  return "PayPal API credentials and webhook ID verified.";
}

export async function verifyPaymentProviderConfig(id: string) {
  const actor = await requireProviderManagement();
  const configId = z.string().trim().min(1).max(128).parse(id);
  const config = await prisma.paymentProviderConfig.findUnique({ where: { id: configId } });
  if (!config || !config.encryptedCredentials || config.status === PaymentProviderConfigStatus.ARCHIVED) {
    throw new Error("A configured, non-archived provider is required for verification.");
  }

  try {
    const credentials = decryptCredentials(config.encryptedCredentials, config.credentialsKeyVersion);
    validateCredentials(config.providerKey as "stripe" | "paypal", credentials, config.environment);
    const message = config.providerKey === "stripe"
      ? await verifyStripe(credentials)
      : await verifyPayPal(credentials, config.environment);
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.paymentProviderConfig.update({
        where: { id: configId },
        data: {
          lastVerifiedAt: now, lastVerificationStatus: "SUCCESS", lastVerificationMessage: message,
          status: config.status === PaymentProviderConfigStatus.DRAFT ? PaymentProviderConfigStatus.CONFIGURED : config.status
        }
      });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER, actorId: actor.userId,
          action: "payment.provider.verified", resource: "payment_provider_config", resourceId: configId,
          scopeType: "GLOBAL", scopeId: "GLOBAL", occurredAt: now,
          metadata: { providerKey: config.providerKey, environment: config.environment, result: "SUCCESS" }
        }
      });
      return item;
    });
    return publicConfig(updated);
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message.slice(0, 280) : "Provider verification failed.";
    await prisma.paymentProviderConfig.update({
      where: { id: configId },
      data: { lastVerifiedAt: new Date(), lastVerificationStatus: "FAILED", lastVerificationMessage: safeMessage }
    });
    throw error;
  }
}

export async function setPaymentProviderConfigStatus(id: string, enabled: boolean) {
  const actor = await requireProviderManagement();
  const configId = z.string().trim().min(1).max(128).parse(id);
  const config = await prisma.paymentProviderConfig.findUnique({ where: { id: configId } });
  if (!config || config.status === PaymentProviderConfigStatus.ARCHIVED) throw new Error("Payment provider configuration was not found.");
  if (enabled && (!config.encryptedCredentials || config.lastVerificationStatus !== "SUCCESS")) {
    throw new Error("Verify provider credentials successfully before enabling this configuration.");
  }

  const status = enabled ? PaymentProviderConfigStatus.ACTIVE : PaymentProviderConfigStatus.DISABLED;
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.paymentProviderConfig.update({ where: { id: configId }, data: { status } });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: enabled ? "payment.provider.enabled" : "payment.provider.disabled",
        resource: "payment_provider_config", resourceId: configId,
        scopeType: "GLOBAL", scopeId: "GLOBAL",
        metadata: { providerKey: config.providerKey, environment: config.environment, previousStatus: config.status, nextStatus: status }
      }
    });
    return item;
  });
  return publicConfig(updated);
}

export async function archivePaymentProviderConfig(id: string) {
  const actor = await requireProviderManagement();
  const configId = z.string().trim().min(1).max(128).parse(id);
  const config = await prisma.paymentProviderConfig.findUnique({ where: { id: configId } });
  if (!config || config.status === PaymentProviderConfigStatus.ARCHIVED) throw new Error("Payment provider configuration was not found.");

  const [activePayments, pendingEvents] = await Promise.all([
    prisma.payment.count({
      where: { provider: config.providerKey, status: { in: [PaymentStatus.INITIATING, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] } }
    }),
    prisma.paymentWebhookEvent.count({ where: { provider: config.providerKey, processedAt: null } })
  ]);
  if (activePayments || pendingEvents) throw new Error("Cannot archive a provider while active payment attempts or unprocessed webhook events exist.");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.paymentProviderConfig.update({
      where: { id: configId },
      data: { status: PaymentProviderConfigStatus.ARCHIVED, archivedAt: now }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "payment.provider.archived", resource: "payment_provider_config", resourceId: configId,
        scopeType: "GLOBAL", scopeId: "GLOBAL", occurredAt: now,
        metadata: { providerKey: config.providerKey, environment: config.environment }
      }
    });
    return item;
  });
  return publicConfig(updated);
}
