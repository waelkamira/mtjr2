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
  APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters"),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must contain at least 32 characters").optional(),
  PUBLIC_REGISTRATION_ENABLED: z.enum(["true", "false"]).optional(),
<<<<<<< HEAD
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
=======
  RESEND_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  RESEND_FROM_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional()),
>>>>>>> 442aae41dfb67a4b1bc8871948cab095bcdb9ade
  GOOGLE_CLIENT_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  TRUSTED_PROXY_IP_HEADER: z.enum(["cf-connecting-ip", "x-vercel-forwarded-for"]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type ApplicationEnvironment = Omit<z.infer<typeof environmentSchema>, "PUBLIC_REGISTRATION_ENABLED"> & { PUBLIC_REGISTRATION_ENABLED: "true" | "false" };

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
    PUBLIC_REGISTRATION_ENABLED: result.data.PUBLIC_REGISTRATION_ENABLED ?? (result.data.NODE_ENV === "production" ? "false" : "true")
  };
}

export function isPublicRegistrationEnabled(environment: ApplicationEnvironment): boolean {
  return environment.NODE_ENV !== "production" && environment.PUBLIC_REGISTRATION_ENABLED === "true";
}

export const env = parseEnvironment(process.env);
