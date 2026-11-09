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
const environmentSchema = z.nativeEnum(PaymentProviderEnvironment);
const countrySchema = z.array(z.string().regex(/^[A-Z]{2}$/)).max(250).transform((values) => [...new Set(values)]);
const currencySchema = z.array(z.string().regex(/^[A-Z]{3}$/)).max(200).transform((values) => [...new Set(values)]);
const methodsSchema = z.array(z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/)).max(40).transform((values) => [...new Set(values)]);

const createSchema = z.object({
  providerKey: providerKeySchema,
  environment: environmentSchema,
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

function validateCredentials(providerKey: "stripe" | "paypal", credentials: ProviderCredentials, environment?: PaymentProviderEnvironment) {
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

