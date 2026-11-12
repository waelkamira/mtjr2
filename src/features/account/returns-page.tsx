"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toast } from "sonner";

type EligibleItem = { id: string; productName: string; sku: string; orderedQuantity: number; availableQuantity: number };
type EligibleOrder = { id: string; orderNumber: string; vendorOrders: Array<{ id: string; storeName: string; items: EligibleItem[] }> };
type ReturnRow = { id: string; returnNumber: string; orderNumber: string; status: string; reasonCode: string; reasonDetails: string | null; reviewNote: string | null; requestedAt: string; refund: { status: string; amountMinor: string; amountDisplay: string } | null; items: Array<{ productName: string; sku: string; quantity: number; status: string; reviewNote: string | null }> };
type Center = { eligibleOrders: EligibleOrder[]; requests: ReturnRow[] };

export default function CustomerReturnsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [center, setCenter] = useState<Center>({ eligibleOrders: [], requests: [] });
  const [selection, setSelection] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reasonCode, setReasonCode] = useState("DAMAGED");
  const [reasonDetails, setReasonDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const options = useMemo(() => center.eligibleOrders.flatMap((order) => order.vendorOrders.flatMap((vendor) => vendor.items.map((item) => ({
    value: order.id + "::" + item.id, orderId: order.id, item, orderNumber: order.orderNumber, storeName: vendor.storeName
  })))), [center]);
  const selected = options.find((option) => option.value === selection);

  async function load() {
    const response = await fetch("/api/returns", { cache: "no-store" });
    const data = await response.json() as Center & { error?: string };
    if (!response.ok) throw new Error(data.error || t("Returns could not be loaded.", "تعذّر تحميل المرتجعات."));
    setCenter({ eligibleOrders: data.eligibleOrders || [], requests: data.requests || [] });
  }
  useEffect(() => { let live = true; fetch("/api/returns", { cache: "no-store" }).then(async (response) => {
    const data = await response.json() as Center & { error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Returns could not be loaded.", "تعذّر تحميل المرتجعات."));
    if (live) { setCenter({ eligibleOrders: data.eligibleOrders || [], requests: data.requests || [] }); const firstOrder = data.eligibleOrders?.[0]; const firstVendor = firstOrder?.vendorOrders?.[0]; const firstItem = firstVendor?.items?.[0]; if (firstOrder && firstItem) setSelection(firstOrder.id + "::" + firstItem.id); }
  }).catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : translate(locale, "Returns could not be loaded.", "تعذّر تحميل المرتجعات.")); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [locale]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        orderId: selected.orderId, reasonCode, reasonDetails, items: [{ orderItemId: selected.item.id, quantity }]
      }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Return request could not be submitted.", "تعذّر إرسال طلب الإرجاع."));
      setNotice(t("Your return request has been submitted. No refund has been initiated.", "تم إرسال طلب الإرجاع. لم يبدأ أي استرداد للمبلغ."));
      toast.success(t("Return request submitted.", "تم إرسال طلب الإرجاع."));
      await load();
    } catch (cause) { const message = cause instanceof Error ? cause.message : t("Return request could not be submitted.", "تعذّر إرسال طلب الإرجاع."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--surface)] shadow-clay-raised px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><nav className="flex gap-4 text-sm"><Link href="/account/orders">{t("Orders", "الطلبات")}</Link><Link href="/account/profile">{t("My account", "حسابي")}</Link></nav></div></header>
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-5 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Customer care", "خدمة العملاء")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Returns", "المرتجعات")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("Request a return for delivered items and follow its review. Return eligibility and quantity are checked against your order. This workflow does not initiate a payment refund.", "اطلب إرجاع المنتجات التي تم توصيلها وتابع مراجعة الطلب. يتم التحقق من أهلية الإرجاع والكمية مقارنة بطلبك. لا تبدأ هذه العملية استردادًا للمبلغ.")}</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--color-ink-800)]">{notice}</p>}
      <section className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-6">
        <h2 className="text-lg font-semibold">{t("Start a return", "بدء طلب إرجاع")}</h2>
        {loading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-[var(--surface-soft)]"/> : options.length ? <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium md:col-span-2">{t("Delivered order item", "المنتج المُسلّم من الطلب")}
            <select required value={selection} onChange={(event) => { setSelection(event.target.value); setQuantity(1); }} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-3">
              {options.map((option) => <option key={option.value} value={option.value}>{option.orderNumber} · {option.storeName} · {option.item.productName} ({t("up to", "حتى")} {option.item.availableQuantity})</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">{t("Quantity", "الكمية")}
            <input type="number" min={1} max={selected?.item.availableQuantity || 1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="rounded-xl border border-[var(--border)] p-3"/>
          </label>
          <label className="grid gap-2 text-sm font-medium">{t("Reason", "السبب")}
            <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-3">
              <option value="DAMAGED">{t("Item arrived damaged", "وصل المنتج تالفًا")}</option><option value="WRONG_ITEM">{t("Wrong item received", "استلمت منتجًا غير صحيح")}</option><option value="NOT_AS_DESCRIBED">{t("Not as described", "لا يطابق الوصف")}</option><option value="CHANGED_MIND">{t("Changed my mind", "غيّرت رأيي")}</option><option value="OTHER">{t("Other", "أخرى")}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">{t("Additional details", "تفاصيل إضافية")}
            <textarea rows={3} maxLength={2000} value={reasonDetails} onChange={(event) => setReasonDetails(event.target.value)} className="rounded-xl border border-[var(--border)] p-3" placeholder={t("Describe the issue (optional)", "صف المشكلة (اختياري)")}/>
          </label>
          <div className="md:col-span-2"><button disabled={busy || !selected || quantity > (selected?.item.availableQuantity || 0)} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Submitting…", "جارٍ الإرسال…") : t("Submit return request", "إرسال طلب الإرجاع")}</button></div>
        </form> : <p className="mt-3 text-sm text-[var(--muted)]">{t("No delivered items currently have remaining return quantity. Check back after an order is delivered.", "لا توجد حاليًا منتجات مُسلّمة بكمية متبقية قابلة للإرجاع. تحقق مجددًا بعد تسليم طلب.")}</p>}
      </section>
      <section className="mt-8"><h2 className="text-xl font-semibold">{t("Your return requests", "طلبات الإرجاع")}</h2>
        {loading ? <div className="mt-4 h-32 animate-pulse rounded-2xl bg-[var(--surface-soft)]"/> : center.requests.length ? <div className="mt-4 space-y-3">{center.requests.map((row) => <article key={row.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-5">
          <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-semibold text-[var(--color-lavender-600)]">{row.returnNumber} · {row.orderNumber}</p><div className="mt-1 flex flex-wrap gap-2">{row.items.map((item) => <span key={item.sku} className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-2 py-1 text-xs font-medium">{item.productName} × {item.quantity}<StatusBadge locale={locale} status={item.status} /></span>)}</div></div><StatusBadge locale={locale} status={row.status} className="h-fit" /></div>
          <p className="mt-2 text-xs text-[var(--muted)]">{row.reasonCode.replaceAll("_", " ")} · {new Date(row.requestedAt).toLocaleString(locale === "ar" ? "ar" : "en")}</p>
          {row.items.filter((item) => item.reviewNote).map((item) => <p key={item.sku} className="mt-2 rounded-xl bg-[var(--surface-soft)] p-3 text-sm">{item.sku}: {item.reviewNote}</p>)}{row.reviewNote && <p className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-sm">{row.reviewNote}</p>}
        </article>)}</div> : <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-6 text-sm text-[var(--muted)]">{t("You have not requested a return yet.", "لم تطلب إرجاع أي منتج بعد.")}</p>}
      </section>
    </div>
  </main>;
}
