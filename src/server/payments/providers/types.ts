export class PaymentProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderConfigurationError";
  }
}

export class PaymentProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderUnavailableError";
  }
}

export class PaymentWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentWebhookSignatureError";
  }
}

export type PaymentProviderIntentInput = {
  paymentId: string;
  orderNumber: string;
  amountMinor: string;
  currencyCode: string;
  idempotencyKey: string;
  returnUrl: string;
  metadata: Record<string, string>;
  providerCredentials?: Record<string, string>;
  providerEnvironment?: "TEST" | "LIVE";
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

export interface PaymentProviderAdapter extends PaymentRefundProvider {
  key: string;
  displayName: string;
  createIntent(input: PaymentProviderIntentInput): Promise<PaymentProviderIntentResult>;
  verifyWebhook(request: Request, credentials?: Record<string, string>, environment?: "TEST" | "LIVE"): Promise<VerifiedPaymentEvent>;
}


export type ProviderRefundInput = {
  providerReference: string;
  amountMinor: string;
  currencyCode: string;
  idempotencyKey: string;
  refundId: string;
  providerCredentials?: Record<string, string>;
  providerEnvironment?: "TEST" | "LIVE";
};

export type ProviderRefundResult = {
  providerRefundReference: string;
  status: "COMPLETED" | "PROCESSING" | "FAILED";
};

export interface PaymentRefundProvider {
  createRefund(input: ProviderRefundInput): Promise<ProviderRefundResult>;
  getRefundStatus(
    refundReference: string,
    credentials?: Record<string, string>,
    environment?: "TEST" | "LIVE"
  ): Promise<ProviderRefundResult["status"]>;
}
