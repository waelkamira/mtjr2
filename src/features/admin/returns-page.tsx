"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";

type ReturnRow = { id: string; returnNumber: string; orderNumber: string; customer: string; customerEmail: string; status: string; reasonCode: string; reasonDetails: string | null; reviewNote: string | null; requestedAt: string; items: Array<{ productName: string; sku: string; storeName: string; orderedQuantity: number; quantity: number }> };
export default function AdminReturnsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const reasonLabel = (reason: string) => ({ DEFECTIVE: t("Defective", "معيب"), DAMAGED: t("Damaged", "تالف"), WRONG_ITEM: t("Wrong item", "منتج خاطئ"), NOT_AS_DESCRIBED: t("Not as described", "غير مطابق للوصف"), CHANGED_MIND: t("Changed my mind", "تغيير الرأي"), OTHER: t("Other", "سبب آخر") }[reason] || translateStatus(locale, reason));
  const [items, setItems] = useState<ReturnRow[]>([]);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queueQuery, setQueueQuery] = useState("");
  const [queueStatus, setQueueStatus] = useState("");
  async function load() {
    const response = await fetch("/api/admin/returns", { cache: "no-store" });
    const data = await response.json() as { items?: ReturnRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || t("Return queue unavailable.", "قائمة طلبات الإرجاع غير متاحة."));
    setItems(data.items || []);
    if (!selected && data.items?.[0]) setSelected(data.items[0].id);
  }
  useEffect(() => { let live = true; fetch("/api/admin/returns", { cache: "no-store" }).then(async (response) => {
    const data = await response.json() as { items?: ReturnRow[]; error?: string };
    if (!response.ok) throw new Error(data.error || t("Return queue unavailable.", "قائمة طلبات الإرجاع غير متاحة."));
    if (live) { setItems(data.items || []); if (data.items?.[0]) setSelected(data.items[0].id); }
  }).catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : t("Return queue unavailable.", "قائمة طلبات الإرجاع غير متاحة.")); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  const visibleItems = useMemo(() => items.filter((item) => {
    const needle = queueQuery.trim().toLocaleLowerCase();
    const matchesQuery = !needle || [item.returnNumber, item.orderNumber, item.customer, item.customerEmail].some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesQuery && (!queueStatus || item.status === queueStatus);
  }), [items, queueQuery, queueStatus]);
  const row = items.find((item) => item.id === selected);
  async function update(status: "APPROVED" | "REJECTED") {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/returns/" + encodeURIComponent(selected), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Return update failed.", "تعذّر تحديث طلب الإرجاع."));
      setNote(""); await load();
      toast.success(status === "APPROVED" ? t("Return approved.", "تمت الموافقة على الإرجاع.") : t("Return rejected.", "تم رفض طلب الإرجاع."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : t("Return update failed.", "تعذّر تحديث طلب الإرجاع."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  return <main aria-busy={loading || busy} className="min-h-screen bg-[var(--background)]">
    <div className="mx-auto max-w-[1600px] px-5 py-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Customer operations", "عمليات العملاء")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Return requests", "طلبات الإرجاع")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("Review the entire customer return request. An admin decision applies to every pending item in the request, including items from different stores. Physical receipt is recorded separately by the seller and does not initiate a refund.", "راجع طلب الإرجاع كاملاً. يطبق قرار الإدارة على جميع العناصر المعلّقة في الطلب، بما فيها العناصر التابعة لمتاجر مختلفة. يسجل البائع الاستلام الفعلي بشكل منفصل، ولا يؤدي ذلك إلى بدء رد الأموال.")}</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]"/> : <div aria-busy={loading || busy} className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-3"><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm font-semibold text-[var(--foreground)]">{t("Return queue", "قائمة المرتجعات")}</span><button type="button" disabled={busy || loading} onClick={() => { setLoading(true); setError(""); void load().catch((cause) => setError(cause instanceof Error ? cause.message : t("Return queue unavailable.", "قائمة طلبات الإرجاع غير متاحة."))).finally(() => setLoading(false)); }} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:border-[#FF8C1C] hover:text-[#C65D0A] disabled:opacity-50">{t("Refresh", "تحديث")}</button></div><label className="block text-xs font-semibold text-[var(--muted)]">{t("Search returns", "البحث في المرتجعات")}<input type="search" value={queueQuery} onChange={(event) => setQueueQuery(event.target.value)} placeholder={t("Return, order or customer", "رقم الإرجاع أو الطلب أو العميل")} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label><label className="mt-2 block text-xs font-semibold text-[var(--muted)]">{t("Filter by status", "تصفية حسب الحالة")}<select value={queueStatus} onChange={(event) => setQueueStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C]"><option value="">{t("All statuses", "كل الحالات")}</option>{["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "INSPECTED", "REFUNDED"].map((value) => <option key={value} value={value}>{translateStatus(locale, value)}</option>)}</select></label><p className="mt-2 text-xs text-[var(--muted)]">{visibleItems.length} {t("of", "من")} {items.length} {t("returns", "طلب إرجاع")}</p></div>{visibleItems.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => { setSelected(item.id); setNote(""); }} className={"w-full rounded-2xl border bg-[var(--surface)] p-4 text-left disabled:opacity-60 " + (selected === item.id ? "border-[#FF8C1C] bg-orange-50/70 shadow-sm" : "border-[var(--border)] hover:border-[#FF8C1C]/50")}><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-[var(--color-lavender-600)]">{item.returnNumber}</span><StatusBadge locale={locale} status={item.status} /></div><p className="mt-2 font-semibold">{item.orderNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.customer} · {item.items.length} {t("item(s)", "منتج/منتجات")}</p></button>)}{!visibleItems.length && <p className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">{items.length ? t("No returns match these filters.", "لا توجد مرتجعات تطابق عوامل التصفية.") : t("No return requests.", "لا توجد طلبات إرجاع.")}</p>}</aside>
        <section>{row && <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><p className="text-xs text-[var(--color-lavender-600)]">{row.returnNumber} · {row.orderNumber}</p><h2 className="mt-2 text-xl font-semibold">{row.customer}</h2><p className="mt-1 text-sm text-[var(--muted)]">{row.customerEmail} · <StatusBadge locale={locale} status={row.status} /></p><div className="mt-5 divide-y divide-[var(--border)]">{row.items.map((item) => <div key={item.sku} className="flex justify-between gap-4 py-3 text-sm"><span>{item.productName} · {item.sku}<span className="mt-1 block text-xs text-[var(--muted)]">{t("Store:", "المتجر:")} {item.storeName}</span></span><strong>{item.quantity} / {item.orderedQuantity}</strong></div>)}</div><div className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm"><p className="font-semibold">{reasonLabel(row.reasonCode)}</p><p className="mt-1 whitespace-pre-wrap">{row.reasonDetails || t("No additional details.", "لا توجد تفاصيل إضافية.")}</p></div><p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("Platform-wide decision: approving or rejecting here updates every pending return item in this request, not just one store’s items.", "قرار إداري شامل: الموافقة أو الرفض هنا يحدّث جميع عناصر الإرجاع المعلّقة في هذا الطلب، وليس عناصر متجر واحد فقط.")}</p><label className="mt-5 grid gap-2 text-sm font-medium">{t("Review note", "ملاحظة المراجعة")}<textarea disabled={busy} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[#FF8C1C] focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:opacity-60" placeholder={t("Optional note for the customer", "ملاحظة اختيارية للعميل")}/></label>
          <div className="mt-5 flex flex-wrap gap-2">{row.status === "REQUESTED" && <><button disabled={busy} onClick={() => void update("APPROVED")} className="rounded-xl bg-[#FF8C1C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E9780B]">{t("Approve all pending items", "الموافقة على جميع العناصر المعلّقة")}</button><button disabled={busy} onClick={() => void update("REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{t("Reject all pending items", "رفض جميع العناصر المعلّقة")}</button></>}{row.status === "APPROVED" && <p className="text-sm text-[var(--muted)]">{t("Awaiting the seller to record physical receipt into a selected warehouse.", "بانتظار تسجيل البائع للاستلام الفعلي في المستودع المحدد.")}</p>}</div>
        </article>}</section>
      </div>}
    </div>
  </main>;
}
