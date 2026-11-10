const SENSITIVE_AUDIT_KEY = /(password|passphrase|secret|token|authorization|cookie|api.?key|private.?key|credential|session|cvv|cvc|card.?number|iban|bank.?account|refresh.?token|access.?token)/i;

/**
 * Audit metadata is operationally useful but may include arbitrary payloads.
 * Never expose values under credential/payment-secret-shaped keys in the
 * platform UI/API. The source AuditLog record remains unchanged.
 */
export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 8) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, entry]) => [
        key,
        SENSITIVE_AUDIT_KEY.test(key) ? "[redacted]" : sanitizeAuditMetadata(entry, depth + 1)
      ])
    );
  }
  if (typeof value === "string" && value.length > 4000) return `${value.slice(0, 4000)}… [truncated]`;
  return value;
}
