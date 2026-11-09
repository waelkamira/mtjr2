import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AuditActorType, PaymentProviderConfigStatus, PaymentProviderEnvironment, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";
import { userHasPermission } from "@/server/identity/permission-repository";
import { PermissionDeniedError } from "@/server/identity/access-errors";

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

function encryptionKey() {
  const value = env.PAYMENT_PROVIDER_ENCRYPTION_KEY;
  if (!value) throw new Error("Provider credential vault is not configured. Set PAYMENT_PROVIDER_ENCRYPTION_KEY.");
  return Buffer.from(value, "hex");
}

function encryptCredentials(credentials: ProviderCredentials) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptCredentials(value: string, keyVersion: number): ProviderCredentials {
  if (keyVersion !== 1) throw new Error("Unsupported provider credential key version.");
  const [version, noncePart, tagPart, ciphertextPart, extra] = value.split(".");
  if (version !== "v1" || !noncePart || !tagPart || !ciphertextPart || extra !== undefined) {
    throw new Error("Stored provider credentials have an invalid encrypted envelope.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(noncePart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Stored provider credentials are invalid.");
  return parsed as ProviderCredentials;
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
    if (!/^[A-Za-z0-9]{8,64}$/.test(credentials.webhookId)) throw new Error("PayPal webhook ID format is invalid.");
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
  const encryptedCredentials = encryptCredentials(parsed.credentials);
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.paymentProviderConfig.create({
      data: {
        providerKey: parsed.providerKey, displayName: parsed.displayName,
        environment: parsed.environment, status: PaymentProviderConfigStatus.CONFIGURED,
        encryptedCredentials, credentialsKeyVersion: 1,
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

  let encryptedCredentials: string | undefined;
  let credentialFingerprint = existing.credentialFingerprint;
  if (parsed.credentials) {
    validateCredentials(existing.providerKey as "stripe" | "paypal", parsed.credentials, existing.environment);
    encryptedCredentials = encryptCredentials(parsed.credentials);
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
          encryptedCredentials, credentialFingerprint,
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
