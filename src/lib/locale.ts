export const supportedLocales = ["ar", "en"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "ar";
export const localeCookieName = "mtjr-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

export function translate(locale: Locale, english: string, arabic: string): string {
  return locale === "ar" ? arabic : english;
}


const statusArabic: Record<string, string> = {
  DRAFT: "مسودة", ACTIVE: "نشط", INACTIVE: "غير نشط", PENDING: "قيد الانتظار",
  PENDING_PAYMENT: "بانتظار الدفع", AWAITING_PAYMENT: "بانتظار الدفع", PAID: "مدفوع",
  SUCCEEDED: "ناجح", SUCCESS: "ناجح", FAILED: "فاشل", REJECTED: "مرفوض",
  APPROVED: "مقبول", PROCESSING: "قيد المعالجة", SHIPPED: "تم الشحن",
  IN_TRANSIT: "في الطريق", OUT_FOR_DELIVERY: "خرج للتوصيل", DELIVERED: "تم التسليم",
  COMPLETED: "مكتمل", CANCELLED: "ملغي", CANCELED: "ملغي", RETURNED: "مرتجع",
  RETURN_REQUESTED: "طلب إرجاع", REFUNDED: "تم رد المبلغ", PARTIALLY_REFUNDED: "تم رد جزء من المبلغ",
  PENDING_MANUAL: "بانتظار المعالجة اليدوية", PROCESSING_PROVIDER: "قيد التنفيذ لدى مزود الدفع", PROVIDER_FAILED: "تعذر تأكيد الرد لدى المزود", REQUESTED: "مطلوب", RECEIVED: "مستلم",
  INSPECTED: "تم الفحص", READY_FOR_PICKUP: "جاهز للاستلام", PICKED_UP: "تم الاستلام",
  EXPIRED: "منتهي الصلاحية", SUSPENDED: "موقوف", DISABLED: "معطل", OPEN: "مفتوح",
  CLOSED: "مغلق", RESOLVED: "تم الحل", UNRESOLVED: "لم يتم الحل", UNDER_REVIEW: "قيد المراجعة",
  SUBMITTED: "تم التقديم", ON_HOLD: "معلق", PARTIALLY_FULFILLED: "منفذ جزئياً",
  FULFILLED: "تم التنفيذ", REFUND_PENDING: "رد المبلغ قيد الانتظار", VOIDED: "ملغي",
  PUBLISHED: "منشور", HIDDEN: "مخفي", ARCHIVED: "مؤرشف", CONFIRMED: "مؤكد",
  READY_TO_SHIP: "جاهز للشحن", EXCEPTION: "استثناء", ANSWERED: "تمت الإجابة",
  AWAITING_ANSWER: "بانتظار الإجابة", PENDING_REVIEW: "قيد المراجعة",
  INVITED: "مدعو", REVOKED: "ملغى", LOCKED: "مقفل", BLOCKED: "محظور", ENABLED: "مفعّل"
};

function humanizeStatus(status: string): string {
  return status.toLocaleLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
}

export function translateStatus(locale: Locale, status: string): string {
  const normalized = status.trim().toLocaleUpperCase();
  if (!normalized) return status;
  return locale === "ar" ? statusArabic[normalized] ?? humanizeStatus(status) : humanizeStatus(status);
}
