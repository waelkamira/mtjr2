"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import Link from "next/link";

type AdminPayment = {
  id: string; orderId: string; provider: string; status: string; amountMinor: string; currencyCode: string;
  currency: { minorUnit: number }; failureCode: string | null; failureMessage: string | null;
  expiresAt: string | null; succeededAt: string | null; lastProviderEventAt: string | null;
  createdAt: string; updatedAt: string;
  order: { orderNumber: string; status: string; totalMinor: string; currencyCode: string; currency: { minorUnit: number }; placedAt: string; user: { id: string; email: string; displayName: string | null } | null };
  events: Array<{ id: string; provider: string; eventType: string; payloadHash: string; receivedAt: string; processedAt: string | null; processingError: string | null }>;
};

function money(amount: string, currency: string, minorUnit: number) {
  const value = BigInt(amount);
  const divisor = BigInt(10) ** BigInt(minorUnit);
  const whole = value / divisor;
  const fraction = minorUnit ? `.${(value % divisor).toString().padStart(minorUnit, "0")}` : "";
  return `${currency} ${new Intl.NumberFormat().format(whole)}${fraction}`;
}

export default function AdminPaymentDetailPage({ paymentId }: { paymentId: string }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [payment, setPayment] = useState<AdminPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store" });
        const result = await response.json() as { payment?: AdminPayment; error?: string };
        if (!response.ok || !result.payment) throw new Error(result.error || "Payment details unavailable.");
        if (active) { setPayment(result.payment); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Payment details unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [paymentId]);

  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8"><div className="mx-auto max-w-5xl">
    <Link href="/admin/payments" className="text-sm font-semibold text-[#C65D0A] underline">{t("Back to payments", "العودة إلى المدفوعات")}</Link>
    {loading && <div className="mt-5 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {payment && <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#C65D0A]">{t("Financial operations", "العمليات المالية")}</p><h1 className="mt-1 text-3xl font-semibold text-[var(--foreground)]">{t("Payment attempt", "محاولة دفع")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{payment.id}</p></div><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm font-semibold"><StatusBadge locale={locale} status={payment.status} /></span></div>
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Transaction", "المعاملة")}</h2><dl className="mt-3 space-y-2 text-sm"><div>{t("Provider:", "مزود الخدمة:")} {payment.provider}</div><div>{t("Amount:", "المبلغ:")} {money(payment.amountMinor, payment.currencyCode, payment.currency.minorUnit)}</div><div>{t("Created:", "تاريخ الإنشاء:")} {new Date(payment.createdAt).toLocaleString()}</div><div>{t("Updated:", "آخر تحديث:")} {new Date(payment.updatedAt).toLocaleString()}</div><div>{t("Expires:", "تنتهي في:")} {payment.expiresAt ? new Date(payment.expiresAt).toLocaleString() : t("Not set", "غير محدد")}</div><div>{t("Succeeded:", "نجحت:")} {payment.succeededAt ? new Date(payment.succeededAt).toLocaleString() : t("No", "لا")}</div><div>{t("Latest provider event:", "آخر حدث من المزود:")} {payment.lastProviderEventAt ? new Date(payment.lastProviderEventAt).toLocaleString() : t("None", "لا يوجد")}</div></dl></article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Order and customer", "الطلب والعميل")}</h2><p className="mt-3 text-sm"><Link href={`/admin/orders/${encodeURIComponent(payment.orderId)}`} className="font-semibold underline">{payment.order.orderNumber}</Link> · <StatusBadge locale={locale} status={payment.order.status} /></p><p className="mt-1 text-sm">{t("Order total:", "إجمالي الطلب:")} {money(payment.order.totalMinor, payment.order.currencyCode, payment.order.currency.minorUnit)}</p><p className="mt-1 text-sm">{payment.order.user?.displayName || payment.order.user?.email || t("Guest checkout", "شراء كضيف")}</p>{payment.order.user && <Link href={`/admin/users/${encodeURIComponent(payment.order.user.id)}`} className="mt-1 inline-block text-sm underline">{payment.order.user.email}</Link>}</article>
      </section>
      {payment.failureCode && <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5"><h2 className="font-semibold text-red-900">{t("Payment failure or reconciliation state", "حالة فشل الدفع أو التسوية")}</h2><p className="mt-2 text-sm text-red-900">{payment.failureCode}</p>{payment.failureMessage && <p className="mt-1 text-sm text-red-800">{payment.failureMessage}</p>}</section>}
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Webhook processing history", "سجل معالجة Webhook")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("Payloads and provider references are not exposed; hashes identify the persisted event payload without revealing it.", "لا يتم عرض محتويات البيانات أو مراجع المزود؛ تُستخدم البصمات للتعرف على الحدث المحفوظ دون كشف محتواه.")}</p>{payment.events.length ? <ol className="mt-4 space-y-4">{payment.events.map((event) => <li key={event.id} className="border-l-2 border-[var(--color-copper-600)] pl-4"><p className="text-sm font-semibold">{event.provider} · {event.eventType}</p><p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">{t("SHA-256", "SHA-256")} {event.payloadHash}</p><p className="mt-1 text-xs text-[var(--muted)]">{t("Received", "تم الاستلام")} {new Date(event.receivedAt).toLocaleString()} · {event.processedAt ? `${t("processed", "تمت المعالجة")} ${new Date(event.processedAt).toLocaleString(locale === "ar" ? "ar" : "en")}` : t("not processed", "لم تتم المعالجة")}</p>{event.processingError && <p className="mt-1 text-sm text-red-700">{event.processingError}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-[var(--muted)]">{t("No webhook events are associated with this payment.", "لا توجد أحداث Webhook مرتبطة بهذه الدفعة.")}</p>}</section>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t("This inspection page is read-only. Refunds, chargebacks, settlements, accounting entries, and payouts require financial models and approved workflows that are not currently implemented.", "هذه الصفحة للعرض فقط. تتطلب عمليات رد الأموال والاعتراضات والتسويات والقيود المحاسبية والتحويلات نماذج مالية وسير عمل معتمداً لم يُنفذ بعد.")}</p>
    </>}
  </div></main>;
}
