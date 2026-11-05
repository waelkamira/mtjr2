import "server-only";

import { env } from "@/lib/env";

interface ResendEmailPayload {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

interface ResendApiResponse {
  id?: string;
}

function requireResendConfiguration(): { apiKey: string; from: string } {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Transactional email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }
  return { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL };
}

async function sendEmail(payload: ResendEmailPayload, idempotencyKey?: string): Promise<string> {
  const configuration = requireResendConfiguration();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify({ ...payload, from: configuration.from }),
    cache: "no-store"
  });

  if (!response.ok) {
    // Do not expose provider response bodies or credentials to callers/logs.
    throw new Error(`Resend delivery failed with status ${response.status}.`);
  }

  const result = (await response.json()) as ResendApiResponse;
  if (!result.id) throw new Error("Resend did not confirm email acceptance.");
  return result.id;
}

function buildActionUrl(path: string, token: string): string {
  const url = new URL(path, env.APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export interface TransactionalEmailAdapter {
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

/**
 * Server-only Resend adapter. Raw tokens are used only in recipient links;
 * they are never persisted by this adapter or written to application logs.
 */
export const resendEmailAdapter: TransactionalEmailAdapter = {
  async sendPasswordResetEmail(to, token) {
    const resetUrl = buildActionUrl("/reset-password", token);
    await sendEmail({
      to: [to],
      subject: "Reset your Mtjr password",
      text: `A password reset was requested. Choose a new password: ${resetUrl}\n\nThis link expires in one hour and can only be used once. If you did not request this, ignore this email.`,
      html: `<p>A password reset was requested for your Mtjr account.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour and can only be used once. If you did not request this, you can ignore this email.</p>`
    });
  }
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

/** Idempotent transactional notification email; the caller supplies a stable outbox id. */
export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  message: string;
  deliveryId: string;
}): Promise<string> {
  const title = escapeHtml(input.title);
  const message = escapeHtml(input.message);
  return sendEmail({
    to: [input.to],
    subject: input.title,
    text: input.message,
    html: `<main><h1>${title}</h1><p>${message}</p><p>Sign in to your Mtjr account to view details.</p></main>`
  }, `notification-delivery-${input.deliveryId}`);
}
