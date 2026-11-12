"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import Link from "next/link";

type Candidate = {
  returnRequestId: string;
  returnNumber: string;
  orderNumber: string;
  currencyCode: string;
  provider: string | null;
  amountMinor: string;
  amountDisplay: string;
  eligible: boolean;
  reason: string | null;
  items: Array<{ productName: string; sku: string; quantity: number }>;
};
type RefundRow = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  provider: string;
  amountMinor: string;
  amountDisplay: string;
  currencyCode: string;
  externalReference: string | null;
  note: string | null;
  requestedAt: string;
  completedAt: string | null;
  items: Array<{ productName: string; sku: string; quantity: number; amountMinor: string }>;
};

export default function AdminRefundsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [externalReferences, setExternalReferences] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const visibleCandidates = useMemo(() => candidates.filter((item) => {
    const needle = query.trim().toLocaleLowerCase();
    const matchesQuery = !needle || [item.returnNumber, item.orderNumber, item.provider || ""].some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesQuery && (!statusFilter || (statusFilter === "ELIGIBLE" ? item.eligible : statusFilter === "INELIGIBLE" ? !item.eligible : true));
  }), [candidates, query, statusFilter]);
  const visibleRefunds = useMemo(() => refunds.filter((item) => {
    const needle = query.trim().toLocaleLowerCase();
    const matchesQuery = !needle || [item.returnNumber, item.orderNumber, item.provider, item.externalReference || ""].some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesQuery && (!statusFilter || statusFilter === "ELIGIBLE" || statusFilter === "INELIGIBLE" || item.status === statusFilter);
  }), [refunds, query, statusFilter]);

  async function load() {
    const response = await fetch("/api/admin/refunds", { cache: "no-store" });
    const data = await response.json() as { candidates?: Candidate[]; refunds?: RefundRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Refund operations could not be loaded.");
    setCandidates(data.candidates ?? []);
    setRefunds(data.refunds ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/refunds", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { candidates?: Candidate[]; refunds?: RefundRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Refund operations could not be loaded.");
      if (active) { setCandidates(data.candidates ?? []); setRefunds(data.refunds ?? []); }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Refund operations could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createRefund(candidate: Candidate) {
    setBusy(candidate.returnRequestId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/refunds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnRequestId: candidate.returnRequestId })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Refund request could not be created.");
      setNotice("Refund request created for " + candidate.returnNumber + ". A different finance operator must submit it to the original provider or reconcile it manually.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund request could not be created.");
    } finally { setBusy(""); }
  }


  async function runProviderRefund(refund: RefundRow, action: "execute" | "refresh") {
    setBusy(refund.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/refunds/" + encodeURIComponent(refund.id), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json() as { error?: string; result?: { status?: string } };
      if (!response.ok) throw new Error(data.error || "Provider refund operation failed.");
      const status = data.result?.status || "updated";
      setNotice(action === "execute"
        ? "Refund submitted to the original payment provider. Current status: " + status + "."
        : "Provider refund status refreshed: " + status + ".");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Provider refund operation failed.");
      await load().catch(() => undefined);
    } finally { setBusy(""); }
  }

  async function completeRefund(refund: RefundRow) {
    const externalReference = (externalReferences[refund.id] || "").trim();
    if (externalReference.length < 4) { setError(t("Enter the external refund transaction reference first.", "أدخل مرجع معاملة رد الأموال الخارجية أولاً.")); return; }
    setBusy(refund.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/refunds/" + encodeURIComponent(refund.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalReference, note: notes[refund.id] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Refund completion could not be recorded.");
      setNotice("External refund confirmation recorded for " + refund.returnNumber + ". The payment status has been updated from the confirmed refund ledger.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund completion could not be recorded.");
    } finally { setBusy(""); }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white px-5 py-5">
      <div className="mx-auto flex max-w-7xl justify-between gap-4">
        <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
        <nav className="flex gap-4 text-sm"><Link href="/admin/returns">{t("Returns", "المرتجعات")}</Link><Link href="/admin">{t("Administration", "الإدارة")}</Link></nav>
      </div>
    </header>
    <div aria-busy={loading || Boolean(busy)} className="mx-auto max-w-[1600px] px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{t("Finance operations", "العمليات المالية")}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("Refunds", "رد الأموال")}</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">{t("Only physically received return items can enter the refund queue. A second finance operator must execute the provider refund or confirm an external refund requested by another operator. Stripe and PayPal status is reconciled before payment status changes.", "تدخل المنتجات المستلمة فعلياً فقط في قائمة رد الأموال. يجب أن ينفذ رد الأموال أو يؤكد الرد الخارجي موظف مالي مختلف عن منشئ الطلب. تتم مطابقة حالة Stripe أو PayPal قبل تغيير حالة الدفع.")}</p>
      <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-[var(--muted)]">{t("Amounts below cover returned merchandise only. Shipping and tax are not automatically refunded or allocated; review them separately before processing an external refund.", "المبالغ أدناه تخص المنتجات المرتجعة فقط. لا تُرد تكاليف الشحن والضرائب تلقائياً؛ راجعها بشكل منفصل قبل تنفيذ رد خارجي.")}</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm">{notice}</p>}
      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"><label className="text-xs font-semibold text-[var(--muted)]">{t("Search refund records", "البحث في سجلات رد الأموال")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Return, order, provider or reference", "الإرجاع أو الطلب أو المزود أو المرجع")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"/></label><label className="text-xs font-semibold text-[var(--muted)]">{t("Filter records", "تصفية السجلات")}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#FF8C1C]"><option value="">{t("All records", "كل السجلات")}</option><option value="ELIGIBLE">{t("Eligible candidates", "مرشحة ومؤهلة")}</option><option value="INELIGIBLE">{t("Ineligible candidates", "مرشحة وغير مؤهلة")}</option>{["PENDING_MANUAL","PROVIDER_FAILED","PROCESSING_PROVIDER","COMPLETED"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label></div>
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : <>
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t("Received returns eligible for refund", "المرتجعات المستلمة المؤهلة لرد الأموال")}</h2><span className="text-xs text-[var(--muted)]">{visibleCandidates.length} / {candidates.length} {t("candidate(s)", "حالة مرشحة")}</span></div>
          {!visibleCandidates.length ? <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-[var(--muted)]">{t("No received returns are waiting for a refund request.", "لا توجد مرتجعات مستلمة بانتظار طلب رد الأموال.")}</p> : <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {visibleCandidates.map((candidate) => <article key={candidate.returnRequestId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold text-[var(--color-copper-600)]">{candidate.returnNumber}</p><p className="text-sm font-semibold">{candidate.amountDisplay}</p></div>
              <p className="mt-2 font-semibold">{t("Order", "الطلب")} {candidate.orderNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">{t("Payment provider:", "مزود الدفع:")} {candidate.provider || t("Unavailable", "غير متاح")}</p>
              <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">{candidate.items.map((item) => <li key={item.sku}>{item.productName} · {item.sku} × {item.quantity}</li>)}</ul>
              {!candidate.eligible && <p className="mt-3 text-sm text-red-700">{candidate.reason || t("This return is not eligible.", "هذا الإرجاع غير مؤهل.")}</p>}
              <button disabled={!candidate.eligible || Boolean(busy)} onClick={() => void createRefund(candidate)} className="mt-4 rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E9780B] disabled:opacity-50">{busy === candidate.returnRequestId ? t("Creating…", "جارٍ الإنشاء…") : t("Create refund request", "إنشاء طلب رد الأموال")}</button>
            </article>)}
          </div>}
        </section>
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t("Refund ledger", "سجل عمليات رد الأموال")}</h2><span className="text-xs text-[var(--muted)]">{visibleRefunds.length} / {refunds.length} {t("record(s)", "سجل")}</span></div>
          {!visibleRefunds.length ? <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-[var(--muted)]">{t("No refund records yet.", "لا توجد سجلات لرد الأموال بعد.")}</p> : <div className="mt-4 space-y-4">
            {visibleRefunds.map((refund) => <article key={refund.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-semibold text-[var(--color-copper-600)]">{refund.returnNumber} · Order {refund.orderNumber}</p><p className="mt-1 font-semibold">{refund.amountDisplay}</p></div><div className="text-right"><p className="text-sm font-semibold"><StatusBadge locale={locale} status={refund.status} /></p><p className="text-xs text-[var(--muted)]">{t("Payment:", "الدفع:")} <StatusBadge locale={locale} status={refund.paymentStatus} /> · {t("Provider:", "المزود:")} {refund.provider}</p></div></div>
              <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">{refund.items.map((item) => <li key={item.sku}>{item.productName} · {item.sku} × {item.quantity}</li>)}</ul>
              {refund.status === "PENDING_MANUAL" || refund.status === "PROVIDER_FAILED" ? <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4">
                <p className="text-sm text-[var(--muted)]">{refund.status === "PROVIDER_FAILED" ? t("The provider did not confirm this attempt. Refresh a returned provider reference; if no reference exists, a retry reuses the same key within the provider retention window.", "لم يؤكد المزود هذه المحاولة. حدّث حالة المرجع الموجود؛ وإذا لم يصل مرجع، ستستخدم إعادة المحاولة المفتاح نفسه ضمن فترة الاحتفاظ به لدى المزود.") : t("Submit this refund to the same provider that captured the original payment. The request uses a stable idempotency key.", "أرسل رد المبلغ إلى المزود نفسه الذي استلم الدفعة الأصلية. يستخدم الطلب مفتاحاً ثابتاً لمنع التكرار.")}</p>
                <button disabled={Boolean(busy)} onClick={() => void runProviderRefund(refund, refund.status === "PROVIDER_FAILED" && refund.externalReference ? "refresh" : "execute")} className="w-fit rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E9780B] disabled:opacity-50">{busy === refund.id ? t("Submitting…", "جارٍ الإرسال…") : refund.status === "PROVIDER_FAILED" && refund.externalReference ? t("Reconcile provider refund", "مطابقة حالة الرد لدى المزود") : t("Send refund through provider", "إرسال رد الأموال عبر المزود")}</button>
                <details className="rounded-xl border border-[var(--border)] p-3">
                  <summary className="cursor-pointer text-sm font-semibold">{t("Record an externally completed refund", "تسجيل رد أموال تم خارج المنصة")}</summary>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-sm font-medium">{t("External refund transaction reference", "مرجع معاملة رد الأموال الخارجية")}<input value={externalReferences[refund.id] || ""} onChange={(event) => setExternalReferences((current) => ({ ...current, [refund.id]: event.target.value }))} maxLength={180} minLength={4} className="rounded-xl border border-[var(--border)] px-3 py-2.5" placeholder={t("Reference from the payment provider", "المرجع من مزود الدفع")}/></label>
                    <label className="grid gap-1 text-sm font-medium">{t("Finance note (optional)", "ملاحظة مالية (اختيارية)")}<textarea rows={2} maxLength={1000} value={notes[refund.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [refund.id]: event.target.value }))} className="rounded-xl border border-[var(--border)] p-3"/></label>
                    <button disabled={Boolean(busy) || (externalReferences[refund.id] || "").trim().length < 4} onClick={() => void completeRefund(refund)} className="w-fit rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy === refund.id ? t("Saving…", "جارٍ الحفظ…") : t("Confirm external refund completed", "تأكيد إتمام رد الأموال خارجياً")}</button>
                  </div>
                </details>
              </div> : refund.status === "PROCESSING_PROVIDER" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                <p className="text-sm text-[var(--muted)]">{t("The provider accepted the refund request. Refresh to retrieve its latest canonical status.", "قبل المزود طلب رد الأموال. حدّث الحالة لجلب آخر حالة مؤكدة من المزود.")} {refund.externalReference ? "· " + refund.externalReference : t("No provider reference was stored; safely resume using the same idempotency key.", "لم يُحفظ مرجع لدى المزود؛ يمكن الاستئناف بأمان باستخدام مفتاح منع التكرار نفسه.")}</p>
                <button disabled={Boolean(busy)} onClick={() => void runProviderRefund(refund, refund.externalReference ? "refresh" : "execute")} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy === refund.id ? t("Checking…", "جارٍ التحقق…") : refund.externalReference ? t("Refresh provider status", "تحديث حالة المزود") : t("Resume provider request safely", "استئناف طلب المزود بأمان")}</button>
              </div> : <p className="mt-4 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">Provider reference: {refund.externalReference || t("Not recorded", "غير مسجل")} · {t("Completed", "مكتمل")} {refund.completedAt ? new Date(refund.completedAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB") : "—"}</p>}
            </article>)}
          </div>}
        </section>
      </>}
    </div>
  </main>;
}
