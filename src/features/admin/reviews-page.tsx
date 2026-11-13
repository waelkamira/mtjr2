"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type PendingReview = {
  id: string; rating: number; title: string; body: string; createdAt: string;
  product: { id: string; name: string; slug: string };
  user: { id: string; displayName: string | null; email: string };
  orderItem: { id: string; sku: string; quantity: number; vendorOrder: { order: { orderNumber: string } } };
  media: Array<{ id: string; url: string; altText: string | null }>;
};
type ReviewTarget = {
  kind: "PRODUCT" | "STORE"; id: string; title: string; body: string; status: string;
  product?: { name: string; slug: string };
  store?: { name: string; slug: string };
  user?: { displayName: string | null; email: string };
};
type ReviewReport = { id: string; reason: string; details: string | null; createdAt: string; reporter: { displayName: string | null; email: string }; review: ReviewTarget | null };
type ReviewAppeal = { id: string; reason: string; createdAt: string; author: { displayName: string | null; email: string }; review: ReviewTarget | null };

export default function AdminReviewsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<PendingReview[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [appeals, setAppeals] = useState<ReviewAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/admin/reviews", { cache: "no-store" }),
      fetch("/api/admin/reviews/reports", { cache: "no-store" }),
      fetch("/api/admin/reviews/appeals", { cache: "no-store" })
    ]);
    const [reviewData, reportData, appealData] = await Promise.all(responses.map((response) => response.json())) as [
      { items?: PendingReview[]; error?: string },
      { items?: ReviewReport[]; error?: string },
      { items?: ReviewAppeal[]; error?: string }
    ];
    const failed = responses.findIndex((response) => !response.ok);
    if (failed >= 0) throw new Error([reviewData, reportData, appealData][failed].error || translate(locale, "Review queue could not be loaded.", "تعذر تحميل قائمة المراجعات."));
    setItems(reviewData.items || []);
    setReports(reportData.items || []);
    setAppeals(appealData.items || []);
  }, [locale]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the queue state before the locale-scoped async reload
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.resolve().then(load).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Review queue unavailable.", "قائمة المراجعات غير متاحة.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, locale]);
  async function moderate(item: PendingReview, decision: "PUBLISH" | "REJECT") {
    setBusyId(item.id); setError("");
    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(item.id)}/moderate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reasons[item.id] || undefined })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Review could not be moderated.", "تعذّر الإشراف على المراجعة."));
      await load();
      toast.success(translate(locale, decision === "PUBLISH" ? "Review published." : "Review rejected.", decision === "PUBLISH" ? "تم نشر المراجعة." : "تم رفض المراجعة."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Review could not be moderated.", "تعذّر الإشراف على المراجعة."); setError(message); toast.error(message); }
    finally { setBusyId(""); }
  }
  async function resolveQueueItem(kind: "report" | "appeal", id: string, decision: "DISMISS" | "HIDE" | "UPHOLD" | "RESTORE") {
    const endpoint = kind === "report"
      ? `/api/admin/reviews/reports/${encodeURIComponent(id)}/resolve`
      : `/api/admin/reviews/appeals/${encodeURIComponent(id)}/resolve`;
    setBusyId(id); setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reasons[id] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Review decision could not be saved.", "تعذر حفظ قرار المراجعة."));
      await load();
      toast.success(translate(locale, "Review queue decision saved.", "تم حفظ قرار قائمة المراجعات."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Review decision could not be saved.", "تعذر حفظ قرار المراجعة."); setError(message); toast.error(message); }
    finally { setBusyId(""); }
  }
  return <main aria-busy={loading} className="min-h-screen bg-[var(--background)]">
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-5 sm:py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#E8750A]">{translate(locale, "Marketplace quality", "جودة السوق")}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-6"><h1 className="text-3xl font-semibold text-slate-900">{translate(locale, "Review moderation", "الإشراف على المراجعات")}</h1><p className="text-sm text-[var(--muted)]">{items.length} {translate(locale, "product reviews pending", "مراجعة منتج بانتظار المراجعة")}</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div className="mt-6 space-y-4">{items.map((item) => <article key={item.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs text-[var(--muted)]">{translate(locale, "Product", "المنتج")}</p><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="mt-1 font-semibold text-[#C65D0A] underline">{item.product.name}</Link><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Order", "الطلب")} {item.orderItem.vendorOrder.order.orderNumber} · SKU {item.orderItem.sku}</p></div><div className="text-right"><p className="text-lg text-[#E8750A]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><p className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}</p></div></div>
        <h2 className="mt-5 text-lg font-semibold">{item.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{item.body}</p>{item.media.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.media.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label={translate(locale, "Open customer review image", "فتح صورة مراجعة العميل")}><img src={image.url} alt={image.altText || translate(locale, "Customer review image", "صورة مراجعة العميل")} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}<p className="mt-4 text-xs text-[var(--muted)]">{translate(locale, "Submitted by", "مقدم من")} {item.user.displayName || item.user.email}</p>
        <label className="mt-5 block text-sm font-medium">{translate(locale, "Moderation note (optional)", "ملاحظة الإشراف (اختياري)")}<textarea rows={2} maxLength={500} value={reasons[item.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
        <div className="mt-4 flex flex-wrap gap-3"><button disabled={busyId === item.id} onClick={() => void moderate(item,"PUBLISH")} className="rounded-lg bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#F0780B] disabled:opacity-50">{busyId === item.id ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Publish review", "نشر المراجعة")}</button><button disabled={busyId === item.id} onClick={() => void moderate(item,"REJECT")} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">{translate(locale, "Reject", "رفض")}</button></div>
      </article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No product reviews are awaiting moderation.", "لا توجد مراجعات منتجات بانتظار الإشراف.")}</div> : null}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-3"><h2 className="text-2xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Reported reviews", "المراجعات المبلغ عنها")}</h2><p className="text-sm text-[var(--muted)]">{reports.length} {translate(locale, "pending", "قيد الانتظار")}</p></div>
        {reports.length ? <div className="mt-5 space-y-4">{reports.map((report) => <article key={report.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-xs font-semibold uppercase text-[var(--color-lavender-600)]">{report.reason.replaceAll("_", " ")} · {translate(locale, "Reported by", "أبلغ عنه")} {report.reporter.displayName || report.reporter.email}</p>
          <h3 className="mt-3 font-semibold">{report.review?.title || translate(locale, "Review no longer available", "المراجعة لم تعد متاحة")} {report.review?.kind === "PRODUCT" ? `· ${report.review.product?.name || translate(locale, "Product", "المنتج")}` : report.review?.kind === "STORE" ? `· ${report.review.store?.name || translate(locale, "Store", "المتجر")}` : ""}</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{report.review?.body || ""}</p>
          {report.details && <p className="mt-2 text-sm"><span className="font-medium">{translate(locale, "Report details:", "تفاصيل البلاغ:")}</span> {report.details}</p>}
          <label className="mt-4 block text-sm font-medium">{translate(locale, "Decision note", "ملاحظة القرار")}<textarea rows={2} maxLength={500} value={reasons[report.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [report.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
          <div className="mt-3 flex gap-3"><button disabled={busyId === report.id || (reasons[report.id] || "").trim().length < 3} onClick={() => void resolveQueueItem("report", report.id, "DISMISS")} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">{translate(locale, "Dismiss", "تجاهل")}</button><button disabled={busyId === report.id || (reasons[report.id] || "").trim().length < 3} onClick={() => void resolveQueueItem("report", report.id, "HIDE")} className="rounded-lg bg-[#FF8C1C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#F0780B] disabled:opacity-50">{translate(locale, "Hide review", "إخفاء المراجعة")}</button></div>
        </article>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">{translate(locale, "No reports are awaiting review.", "لا توجد بلاغات بانتظار المراجعة.")}</p>}
      </section>
      <section className="mt-12">
        <div className="flex items-end justify-between gap-3"><h2 className="text-2xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Review appeals", "الطعون على المراجعات")}</h2><p className="text-sm text-[var(--muted)]">{appeals.length} {translate(locale, "pending", "قيد الانتظار")}</p></div>
        {appeals.length ? <div className="mt-5 space-y-4">{appeals.map((appeal) => <article key={appeal.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-xs font-semibold uppercase text-[var(--color-lavender-600)]">{translate(locale, "Appeal by", "الطعن مقدم من")} {appeal.author.displayName || appeal.author.email}</p>
          <h3 className="mt-3 font-semibold">{appeal.review?.title || translate(locale, "Review no longer available", "المراجعة لم تعد متاحة")} {appeal.review?.kind === "PRODUCT" ? `· ${appeal.review.product?.name || translate(locale, "Product", "المنتج")}` : appeal.review?.kind === "STORE" ? `· ${appeal.review.store?.name || translate(locale, "Store", "المتجر")}` : ""}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{appeal.reason}</p>
          <label className="mt-4 block text-sm font-medium">{translate(locale, "Decision note", "ملاحظة القرار")}<textarea rows={2} maxLength={500} value={reasons[appeal.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [appeal.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
          <div className="mt-3 flex gap-3"><button disabled={busyId === appeal.id || (reasons[appeal.id] || "").trim().length < 3} onClick={() => void resolveQueueItem("appeal", appeal.id, "UPHOLD")} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50">{translate(locale, "Uphold decision", "تأييد القرار")}</button><button disabled={busyId === appeal.id || (reasons[appeal.id] || "").trim().length < 3} onClick={() => void resolveQueueItem("appeal", appeal.id, "RESTORE")} className="rounded-xl bg-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{translate(locale, "Restore review", "استعادة المراجعة")}</button></div>
        </article>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">{translate(locale, "No appeals are awaiting review.", "لا توجد طعون بانتظار المراجعة.")}</p>}
      </section>
    </div>
  </main>;
}
