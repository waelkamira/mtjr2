import "server-only";

import type { PaymentProviderAdapter } from "./types";
import { env } from "@/lib/env";
import { stripePaymentProvider } from "./stripe";
import { paypalPaymentProvider } from "./paypal";

const providers = new Map<string, PaymentProviderAdapter>();

if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
  providers.set(stripePaymentProvider.key, stripePaymentProvider);
}

if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID) {
  providers.set(paypalPaymentProvider.key, paypalPaymentProvider);
}

export function registerPaymentProvider(adapter: PaymentProviderAdapter) {
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(adapter.key)) {
    throw new Error("Payment provider key is invalid.");
  }
  if (providers.has(adapter.key)) throw new Error("Payment provider is already registered.");
  providers.set(adapter.key, adapter);
}

export function getPaymentProviderAdapter(key: string) {
  if (key === stripePaymentProvider.key) return stripePaymentProvider;
  if (key === paypalPaymentProvider.key) return paypalPaymentProvider;
  return null;
}

export function getPaymentProvider(key: string) {
  return providers.get(key) ?? null;
}

export function listPaymentProviders() {
  return [...providers.values()].map(({ key, displayName }) => ({ key, displayName }));
}
