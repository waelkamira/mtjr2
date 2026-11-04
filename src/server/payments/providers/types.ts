export type PaymentProviderIntentInput = {
  paymentId: string;
  orderNumber: string;
  amountMinor: string;
  currencyCode: string;
  idempotencyKey: string;
  returnUrl: string;
  metadata: Record<string, string>;
};

export type PaymentProviderIntentResult = {
  providerReference: string;
  checkoutUrl: string;
  expiresAt?: Date | null;
};

export type VerifiedPaymentEvent = {
  eventId: string;
  eventType: "succeeded" | "processing" | "failed" | "cancelled";
  providerReference: string;
  amountMinor: string;
  currencyCode: string;
  occurredAt: Date;
};

export interface PaymentProviderAdapter {
  key: string;
  displayName: string;
  createIntent(input: PaymentProviderIntentInput): Promise<PaymentProviderIntentResult>;
  verifyWebhook(request: Request): Promise<VerifiedPaymentEvent>;
}
