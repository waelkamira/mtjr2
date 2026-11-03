import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use the PostgreSQL protocol"
    ),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type ApplicationEnvironment = z.infer<typeof environmentSchema>;

/**
 * Parse an explicit environment source so configuration can be tested without
 * mutating process.env. Error messages intentionally contain variable names,
 * never secret values.
 */
export function parseEnvironment(
  source: NodeJS.ProcessEnv
): ApplicationEnvironment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid application environment: ${details}`);
  }

  return result.data;
}

export const env = parseEnvironment(process.env);
