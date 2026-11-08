import "server-only";

import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use the PostgreSQL protocol"
    ),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters"),
  GROQ_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  GROQ_MODEL: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().min(1).default("openai/gpt-oss-20b")),
  AI_ASSISTANT_ENABLED: z.preprocess((value) => value === "" ? undefined : value, z.enum(["true", "false"]).default("false")),
  MFA_ENCRYPTION_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must contain at least 32 characters").optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().trim().min(1).optional(),
  PUBLIC_REGISTRATION_ENABLED: z.enum(["true", "false"]).optional(),
  RESEND_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  RESEND_FROM_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional()),
  CONTACT_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional()),
  TURNSTILE_SECRET_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),

  GOOGLE_CLIENT_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  TRUSTED_PROXY_IP_HEADER: z.preprocess((value) => value === "" ? undefined : value, z.enum(["cf-connecting-ip", "x-vercel-forwarded-for"]).optional()),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
}).superRefine((value, context) => {
  const hasPreviewDeploymentUrl = value.VERCEL_ENV === "preview" && Boolean(value.VERCEL_URL);
  if (!value.APP_URL && !value.NEXT_PUBLIC_APP_URL && !hasPreviewDeploymentUrl) {
    context.addIssue({
      code: "custom",
      path: ["APP_URL"],
      message: "APP_URL or NEXT_PUBLIC_APP_URL must be configured"
    });
  }
  if (Boolean(value.TURNSTILE_SECRET_KEY) !== Boolean(value.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
    context.addIssue({
      code: "custom",
      path: ["TURNSTILE_SECRET_KEY"],
      message: "TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY must be configured together"
    });
  }
});

export type ApplicationEnvironment = Omit<z.infer<typeof environmentSchema>, "APP_URL" | "PUBLIC_REGISTRATION_ENABLED"> & {
  APP_URL: string;
  PUBLIC_REGISTRATION_ENABLED: "true" | "false";
};

/**
 * Parse an explicit environment source so configuration can be tested without
 * mutating process.env. Error messages intentionally contain variable names,
 * never secret values.
 */
export function parseEnvironment(
  source: Record<string, string | undefined>
): ApplicationEnvironment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid application environment: ${details}`);
  }

  return {
    ...result.data,
    APP_URL: result.data.APP_URL ?? result.data.NEXT_PUBLIC_APP_URL ?? (result.data.VERCEL_ENV === "preview" && result.data.VERCEL_URL ? `https://${result.data.VERCEL_URL}` : undefined)!,
    PUBLIC_REGISTRATION_ENABLED: result.data.PUBLIC_REGISTRATION_ENABLED ?? (result.data.NODE_ENV === "production" ? "false" : "true")
  };
}

export function isPublicRegistrationEnabled(environment: ApplicationEnvironment): boolean {
  return environment.NODE_ENV !== "production" && environment.PUBLIC_REGISTRATION_ENABLED === "true";
}

export const env = parseEnvironment(process.env);
