"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

type SellerReturn = {
  id: string;
  returnNumber: string;
  orderNumber: string;
  status: string;
  reasonCode: string;
  reasonDetails: string | null;
  reviewNote: string | null;
  requestedAt: string;
  storeId: string;
  storeName: string;
  warehouses: Array<{ id: string; code: string; name: string }>;
  items: Array<{ id: string; productName: string; sku: string; orderedQuantity: number; returnQuantity: number; status: string; reviewNote: string | null }>;
};

export default function SellerReturnsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<SellerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [warehouseByStore, setWarehouseByStore] = useState<Record<string, string>>({});

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const response = await fetch("/api/seller/returns", { cache: "no-store" });
    const data = await response.json() as { items?: SellerReturn[]; error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Seller returns could not be loaded.", "تعذر تحميل المرتجعات."));
    if (!isCurrent()) return;
    const rows = data.items ?? [];
    setItems(rows);
    setWarehouseByStore((current) => {
      const next = { ...current };
      const activeStoreIds = new Set(rows.map((row) => row.storeId));
      for (const storeId of Object.keys(next)) if (!activeStoreIds.has(storeId)) delete next[storeId];
      for (const row of rows) {
        const available = row.warehouses;
        if (!available.some((warehouse) => warehouse.id === next[row.storeId])) {
          if (available[0]) next[row.storeId] = available[0].id;
          else delete next[row.storeId];
        }
      }
      return next;
    });
  }, [locale]);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear returns from the previous locale/query before refreshing the list.
    setItems([]);
    setLoading(true);
    setError("");
    load(() => active)
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Seller returns could not be loaded.", "تعذر تحميل المرتجعات."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, locale]);

  const returnStatusRows = Object.entries(items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>)).map(([status, value], index) => ({
    label: status.replaceAll("_", " ").toLowerCase(), value,
    color: ["bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-rose-500", "bg-violet-500"][index % 5]
  }));
  const returnReasonRows = Object.entries(items.reduce((counts, item) => {
    counts[item.reasonCode] = (counts[item.reasonCode] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, value], index) => ({
    label: reason.replaceAll("_", " ").toLowerCase(), value,
    color: ["bg-fuchsia-500", "bg-[var(--orange)]", "bg-cyan-500", "bg-indigo-500", "bg-teal-500", "bg-pink-500"][index]
  }));
  async function decide(item: SellerReturn, status: "APPROVED" | "REJECTED") {
    const key = item.id + ":" + item.storeId;
    setBusy(key); setError(""); setNotice("");
    try {
      const response = await fetch("/api/seller/returns/" + encodeURIComponent(item.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: item.storeId, status, note: notes[key] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Return decision could not be saved.", "تعذر حفظ قرار الإرجاع."));
      setNotice(status === "APPROVED" ? translate(locale, "Your store's return items were approved.", "تمت الموافقة على عناصر الإرجاع الخاصة بمتجرك.") : translate(locale, "Your store's return items were rejected.", "تم رفض عناصر الإرجاع الخاصة بمتجرك.")); toast.success(status === "APPROVED" ? translate(locale, "Return items approved.", "تمت الموافقة على عناصر الإرجاع.") : translate(locale, "Return items rejected.", "تم رفض عناصر الإرجاع."));
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Return decision could not be saved.", "تعذر حفظ قرار الإرجاع."); setError(message); toast.error(message);
    } finally { setBusy(""); }
  }

  async function receive(item: SellerReturn) {
    const key = item.id + ":" + item.storeId;
    const warehouseId = warehouseByStore[item.storeId];
    if (!warehouseId) { setError(translate(locale, "Create or activate a warehouse for this store before receiving returns.", "أنشئ مستودعًا لهذا المتجر أو فعّله قبل استلام المرتجعات.")); return; }
    setBusy(key); setError(""); setNotice("");
    try {
      const response = await fetch("/api/seller/returns/" + encodeURIComponent(item.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: item.storeId, warehouseId, status: "RECEIVED", note: notes[key] || "" })
      });
      const data = await response.json() as { error?: string; result?: { quarantinedQuantity?: number } };
      if (!response.ok) throw new Error(data.error || translate(locale, "Return receipt could not be recorded.", "تعذر تسجيل استلام المرتجع."));
      setNotice(`${translate(locale, "Physical receipt recorded.", "تم تسجيل الاستلام الفعلي.")} ${data.result?.quarantinedQuantity ?? translate(locale, "Returned", "مرتجع")} ${translate(locale, "unit(s) are held in quarantine and are not sellable until inspected.", "وحدة قيد الحجر ولا يمكن بيعها حتى فحصها.")}`); toast.success(translate(locale, "Return receipt recorded and quarantined.", "تم تسجيل استلام المرتجع ووضعه في الحجر."));
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Return receipt could not be recorded.", "تعذر تسجيل استلام المرتجع."); setError(message); toast.error(message);
    } finally { setBusy(""); }
  }

  return (
    <main className="min-h-screen bg-transparent">
      
      <div className="mx-auto max-w-[1440px] px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{translate(locale, "Seller operations", "عمليات البائع")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Store returns", "مرتجعات المتجر")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{translate(locale, "Review only the return items belonging to each store you own or are authorized to manage. A decision never changes another store's items.", "راجع عناصر الإرجاع التابعة للمتاجر التي تملكها أو لديك صلاحية إدارتها فقط. لا يؤثر القرار مطلقًا في عناصر المتاجر الأخرى.")}</p>
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-4 text-sm text-[var(--muted)]">{translate(locale, "Approval or rejection records the seller's decision. Physical receipt is recorded against a warehouse and placed in quarantine; it does not increase sellable stock or issue a refund.", "تسجل الموافقة أو الرفض قرار البائع. يُسجل الاستلام الفعلي في مستودع ويوضع في الحجر؛ ولا يزيد المخزون القابل للبيع أو يصدر استردادًا للمبلغ.")}</p>
        {!loading && !error && items.length > 0 && <section aria-label={translate(locale, "Returns analytics", "تحليلات المرتجعات")} className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricBarChart title={translate(locale, "Returns by status", "المرتجعات حسب الحالة")} rows={returnStatusRows} />
        <MetricBarChart title={translate(locale, "Return reasons", "أسباب الإرجاع")} description={translate(locale, "Most common reasons in the currently loaded seller returns.", "أكثر أسباب الإرجاع شيوعاً ضمن الطلبات المحمّلة.")} rows={returnReasonRows} />
      </section>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-4 text-sm">{notice}</p>}
        {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? (
          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const key = item.id + ":" + item.storeId;
              const pending = item.items.some((product) => product.status === "REQUESTED");
              return (
                <article key={key} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-6">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div><p className="text-xs text-[var(--muted)]">{item.returnNumber} · {translate(locale, "Order", "الطلب")} {item.orderNumber}</p><h2 className="mt-1 text-lg font-semibold">{item.storeName}</h2></div>
                    <div className="text-right"><p className="font-semibold"><StatusBadge locale={locale} status={item.status} /></p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(item.requestedAt).toLocaleString()}</p></div>
                  </div>
                  <p className="mt-4 text-sm"><span className="font-medium">{translate(locale, "Reason:", "السبب:")}</span> {translate(locale, item.reasonCode, item.reasonCode === "DAMAGED" ? "تالف" : item.reasonCode === "DEFECTIVE" ? "معيب" : item.reasonCode === "WRONG_ITEM" ? "منتج غير صحيح" : item.reasonCode === "NOT_AS_DESCRIBED" ? "لا يطابق الوصف" : item.reasonCode === "CHANGED_MIND" ? "تغيير الرأي" : item.reasonCode.replaceAll("_", " "))}</p>
                  {item.reasonDetails && <p className="mt-1 text-sm text-[var(--muted)]">{item.reasonDetails}</p>}
                  <div className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {item.items.map((product) => <div key={product.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <div><p className="font-medium">{product.productName}</p><p className="text-xs text-[var(--muted)]">{product.sku} · {translate(locale, product.status, product.status === "REQUESTED" ? "مطلوب" : product.status === "APPROVED" ? "مقبول" : product.status === "REJECTED" ? "مرفوض" : product.status === "RECEIVED" ? "تم الاستلام" : product.status.replaceAll("_", " "))}</p>{product.reviewNote && <p className="mt-1 text-xs text-[var(--muted)]">{product.reviewNote}</p>}</div>
                      <p className="tabular-nums">{translate(locale, "Return", "الإرجاع")} {product.returnQuantity} / {translate(locale, "ordered", "المطلوب")} {product.orderedQuantity}</p>
                    </div>)}
                  </div>
                  {item.items.some((product) => product.status === "APPROVED") && <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <label className="grid gap-2 text-sm font-medium">{translate(locale, "Receive approved items into warehouse", "استلام العناصر المعتمدة في المستودع")}
                      <select value={warehouseByStore[item.storeId] || ""} onChange={(event) => setWarehouseByStore((current) => ({ ...current, [item.storeId]: event.target.value }))} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-3">
                        <option value="">{translate(locale, "Select warehouse", "اختر مستودعًا")}</option>
                        {item.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
                      </select>
                    </label>
                    <p className="mt-2 text-xs text-[var(--muted)]">{translate(locale, "Returned units are held separately from sellable stock until inspection.", "تُحفظ الوحدات المرتجعة منفصلة عن المخزون القابل للبيع حتى فحصها.")}</p>
                    <button disabled={Boolean(busy) || !item.warehouses.length} onClick={() => void receive(item)} className="mt-3 rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === key ? translate(locale, "Recording receipt…", "جارٍ تسجيل الاستلام…") : translate(locale, "Receive approved items", "استلام العناصر المعتمدة")}</button>
                  </div>}
                  {pending && <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <label className="grid gap-2 text-sm font-medium">{translate(locale, "Decision note (optional)", "ملاحظة القرار (اختياري)")}
                      <textarea rows={2} maxLength={1000} value={notes[key] || ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} className="rounded-xl border border-[var(--border)] p-3"/>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={Boolean(busy)} onClick={() => void decide(item, "APPROVED")} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === key ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Approve my store's items", "الموافقة على عناصر متجري")}</button>
                      <button disabled={Boolean(busy)} onClick={() => void decide(item, "REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{translate(locale, "Reject my store's items", "رفض عناصر متجري")}</button>
                    </div>
                  </div>}
                </article>
              );
            })}
          </div>
        ) : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No return requests are associated with your authorized stores.", "لا توجد طلبات إرجاع مرتبطة بالمتاجر التي لديك صلاحية إدارتها.")}</div> : null}
      </div>
    </main>
  );
}
