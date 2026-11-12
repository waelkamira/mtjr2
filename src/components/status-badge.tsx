import { translateStatus, type Locale } from "@/lib/locale";

type StatusBadgeProps = {
  status: string;
  locale: Locale;
  className?: string;
};

const positiveStatuses = new Set([
  "ACTIVE", "APPROVED", "PAID", "SUCCEEDED", "SUCCESS", "COMPLETED",
  "DELIVERED", "FULFILLED", "RESOLVED", "RECEIVED", "INSPECTED",
  "PUBLISHED", "CONFIRMED", "ANSWERED", "PICKED_UP", "READY_FOR_PICKUP",
  "REFUNDED", "ENABLED", "VERIFIED", "ACCEPTED", "SETTLED", "READY"
]);

const dangerStatuses = new Set([
  "FAILED", "REJECTED", "PROVIDER_FAILED", "SUSPENDED", "CANCELLED",
  "CANCELED", "VOIDED", "UNRESOLVED", "EXCEPTION", "BLOCKED", "LOCKED",
  "BANNED", "DELETED", "DECLINED", "PAYMENT_FAILED", "DISPUTED", "REFUND_REJECTED"
]);

const warningStatuses = new Set([
  "PENDING", "PENDING_PAYMENT", "AWAITING_PAYMENT", "REQUESTED",
  "RETURN_REQUESTED", "UNDER_REVIEW", "ON_HOLD", "REFUND_PENDING",
  "PENDING_MANUAL", "PROCESSING_PROVIDER", "OPEN", "SUBMITTED",
  "PARTIALLY_FULFILLED", "PARTIALLY_REFUNDED", "PENDING_REVIEW", "PENDING_VERIFICATION", "WAITING_CUSTOMER",
  "AWAITING_ANSWER", "INVITED", "AWAITING_APPROVAL", "PENDING_APPROVAL",
  "PAYMENT_REVIEW", "REQUIRES_ACTION", "DUE"
]);

const infoStatuses = new Set([
  "PROCESSING", "INITIATING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY",
  "RETURNED", "IN_PROGRESS", "PACKING", "READY_TO_SHIP"
]);

const neutralStatuses = new Set([
  "INACTIVE", "DISABLED", "ARCHIVED", "EXPIRED", "DRAFT", "HIDDEN",
  "CLOSED", "REVOKED", "DISCONNECTED", "NOT_STARTED"
]);

function toneClass(status: string) {
  const normalized = status.trim().toUpperCase();

  if (positiveStatuses.has(normalized)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (dangerStatuses.has(normalized)) return "border-rose-200 bg-rose-50 text-rose-800";
  if (warningStatuses.has(normalized)) return "border-amber-200 bg-amber-50 text-amber-900";
  if (infoStatuses.has(normalized)) return "border-sky-200 bg-sky-50 text-sky-800";
  if (neutralStatuses.has(normalized)) return "border-stone-200 bg-stone-100 text-stone-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function StatusBadge({ status, locale, className = "" }: StatusBadgeProps) {
  return (
    <span
      data-status={status.trim().toUpperCase()}
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-5 ${toneClass(status)} ${className}`.trim()}
    >
      {translateStatus(locale, status)}
    </span>
  );
}
