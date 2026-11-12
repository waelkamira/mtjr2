"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

type VendorOrder = {
  id: string; status: string; store: { id: string; name: string; slug: string }; shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null;
  order: { id: string; orderNumber: string; status: string; currencyCode: string; placedAt: string; currency: { minorUnit: number }; address: null | { recipientName: string; phone: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } };
  subtotalMinor: string; shippingMinor: string; taxMinor: string; totalMinor: string;
  shipment: null | {
    carrierName: string; trackingNumber: string; trackingUrl: string | null; shippedAt: string; status: string;
    events: Array<{ status: string; description: string | null; location: string | null; occurredAt: string }>;
  };
  items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; lineTotalMinor: string }>;
};
function money(value: string, code: string, unit: number, locale: string) { return new Intl.NumberFormat(locale === "ar" ? "ar" : "en-GB", { style: "currency", currency: code }).format(Number(value) / (10 ** unit)); }

export default function SellerOrdersPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_PAYMENT: "بانتظار الدفع", CONFIRMED: "مؤكد", PROCESSING: "قيد التجهيز",
      READY_TO_SHIP: "جاهز للشحن", SHIPPED: "تم الشحن", IN_TRANSIT: "في الطريق",
      OUT_FOR_DELIVERY: "خرج للتوصيل", DELIVERED: "تم التوصيل", EXCEPTION: "استثناء",
      CANCELLED: "ملغى", COMPLETED: "مكتمل"
    };
    const english = status.replaceAll("_", " ");
    return translate(locale, english, labels[status] ?? english);
  };
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, { carrierName: string; trackingNumber: string; trackingUrl: string }>>({});

  const statusCounts = orders.reduce((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const storeCounts = orders.reduce((counts, order) => {
    counts[order.store.name] = (counts[order.store.name] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  async function updateOrderStatus(vendorOrderId: string, status: "PROCESSING" | "READY_TO_SHIP") {
    setSavingOrderId(vendorOrderId);
    setActionError("");
    try {
      const response = await fetch(`/api/seller/orders/${vendorOrderId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
      });
      const data = await response.json() as { vendorOrder?: { id: string; status: string }; error?: string };
      if (!response.ok || !data.vendorOrder) throw new Error(data.error || t("Order status could not be updated.", "تعذّر تحديث حالة الطلب."));
      toast.success(t("Order status updated.", "تم تحديث حالة الطلب."));
      setOrders((current) => {
        const selected = current.find((order) => order.id === vendorOrderId);
        return current.map((order) => ({
          ...order,
          ...(order.id === vendorOrderId ? { status: data.vendorOrder!.status } : {}),
          order: selected && order.order.id === selected.order.id && status === "PROCESSING"
            ? { ...order.order, status: "PROCESSING" }
            : order.order
        }));
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Order status could not be updated.", "تعذّر تحديث حالة الطلب.");
      setActionError(message);
      toast.error(message);
    } finally {
      setSavingOrderId(null);
    }
  }

  function updateShipmentDraft(vendorOrderId: string, field: "carrierName" | "trackingNumber" | "trackingUrl", value: string) {
    setShipmentDrafts((current) => {
      const draft = current[vendorOrderId] ?? { carrierName: "", trackingNumber: "", trackingUrl: "" };
      return { ...current, [vendorOrderId]: { ...draft, [field]: value } };
    });
  }
  async function dispatchOrder(vendorOrderId: string) {
    const draft = shipmentDrafts[vendorOrderId];
    if (!draft) return;
    setSavingOrderId(vendorOrderId);
    setActionError("");
    try {
      const response = await fetch(`/api/seller/orders/${encodeURIComponent(vendorOrderId)}/shipment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrierName: draft.carrierName, trackingNumber: draft.trackingNumber, ...(draft.trackingUrl.trim() ? { trackingUrl: draft.trackingUrl.trim() } : {}) })
      });
      const data = await response.json() as { shipment?: VendorOrder["shipment"]; error?: string };
      if (!response.ok || !data.shipment) throw new Error(data.error || t("Shipment could not be recorded.", "تعذّر تسجيل الشحنة."));
      setOrders((current) => current.map((order) => order.id === vendorOrderId ? { ...order, status: "SHIPPED", shipment: data.shipment! } : order));
      setShipmentDrafts((current) => { const next = { ...current }; delete next[vendorOrderId]; return next; });
      toast.success(t("Shipment recorded.", "تم تسجيل الشحنة."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Shipment could not be recorded.", "تعذّر تسجيل الشحنة.");
      setActionError(message);
      toast.error(message);
    } finally {
      setSavingOrderId(null);
    }
  }

  async function addTrackingEvent(event: FormEvent<HTMLFormElement>, vendorOrderId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingOrderId(vendorOrderId);
    setActionError("");
    try {
      const response = await fetch(`/api/seller/orders/${encodeURIComponent(vendorOrderId)}/tracking-events`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.get("status"), location: form.get("location") || undefined,
          description: form.get("description") || undefined
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Tracking update could not be recorded.", "تعذّر تسجيل تحديث التتبع."));
      const refreshed = await fetch("/api/seller/orders", { cache: "no-store" });
      const refreshedData = await refreshed.json() as { orders?: VendorOrder[]; error?: string };
      if (!refreshed.ok) throw new Error(refreshedData.error || t("Tracking was saved, but the order list could not be refreshed.", "تم حفظ تحديث التتبع، لكن تعذر تحديث قائمة الطلبات."));
      setOrders(refreshedData.orders ?? []);
      toast.success(t("Tracking update recorded.", "تم تسجيل تحديث التتبع."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Tracking update could not be recorded.", "تعذّر تسجيل تحديث التتبع.");
      setActionError(message);
      toast.error(message);
    } finally { setSavingOrderId(null); }
  }

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prevent stale orders from a previous search from remaining visible.
    setOrders([]);
    setNextCursor(null);
    setShipmentDrafts({});
    const timer = window.setTimeout(() => { setLoading(true); setError(""); const params = new URLSearchParams(); if (query.trim()) params.set("q", query.trim());
    fetch(`/api/seller/orders?${params.toString()}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { orders?: VendorOrder[]; nextCursor?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || t("Seller orders could not be loaded.", "تعذّر تحميل طلبات البائع."));
      if (active) { setOrders(data.orders || []); setNextCursor(data.nextCursor ?? null); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t("Seller orders could not be loaded.", "تعذّر تحميل طلبات البائع.")); })
      .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, t]);
  async function loadOlderOrders() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/seller/orders?${params.toString()}`, { cache: "no-store" });
      const data = await response.json() as { orders?: VendorOrder[]; nextCursor?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || t("Older orders could not be loaded.", "تعذر تحميل الطلبات الأقدم."));
      setOrders((current) => {
        const known = new Set(current.map((order) => order.id));
        return [...current, ...(data.orders ?? []).filter((order) => !known.has(order.id))];
      });
      setNextCursor(data.nextCursor ?? null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t("Older orders could not be loaded.", "تعذر تحميل الطلبات الأقدم."));
    } finally {
      setLoadingMore(false);
    }
  }

  return <main className="min-h-screen bg-transparent">
    <div className="mx-auto max-w-[1440px] px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Seller operations", "عمليات البائع")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Seller orders", "طلبات البائع")}</h1><p className="mt-2 text-sm text-[var(--muted)]">{t("Orders are separated by store. Paid orders can move through seller preparation and seller-entered shipment tracking.", "تُعرض الطلبات لكل متجر على حدة. يمكن متابعة الطلبات المدفوعة خلال تجهيز البائع وإدخال بيانات تتبع الشحنة.")}</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{actionError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{actionError}</p>}
      {!loading && orders.length > 0 && <section aria-label={t("Seller order analytics", "تحليلات طلبات البائع")} className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricBarChart title={t("Orders by fulfillment status", "الطلبات حسب حالة التنفيذ")} description={t("Counts from the currently loaded seller order list (up to 100 records).", "الأعداد من قائمة طلبات البائع المحمّلة حالياً (حتى 100 سجل).")} rows={Object.entries(statusCounts).map(([status, count], index) => ({
          label: statusLabel(status),
          value: count,
          color: ["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-cyan-500"][index % 6]
        }))} />
        <MetricBarChart title={t("Orders by store", "الطلبات حسب المتجر")} description={t("Counts from the currently loaded seller order list (up to 100 records).", "الأعداد من قائمة طلبات البائع المحمّلة حالياً (حتى 100 سجل).")} rows={Object.entries(storeCounts).slice(0, 8).map(([store, count], index) => ({
          label: store,
          value: count,
          color: ["bg-indigo-500", "bg-fuchsia-500", "bg-teal-500", "bg-[var(--orange)]"][index % 4]
        }))} />
      </section>}
      <label className="mt-6 block max-w-xl text-xs font-medium">{t("Search orders", "ابحث عن الطلبات")}<input value={query} onChange={event=>setQuery(event.target.value)} maxLength={120} placeholder={t("Order number, product, SKU or store", "رقم الطلب أو المنتج أو SKU أو المتجر")} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised px-3 py-2.5 text-sm"/></label>
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : orders.length ? <div className="mt-6 space-y-4">{orders.map((vendor) => <article key={vendor.id} className="rounded-3xl border border-[#eee5dc] bg-white shadow-[0_8px_24px_rgba(119,86,62,.06)] p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{vendor.order.orderNumber} · {new Date(vendor.order.placedAt).toLocaleString(locale)}</p><h2 className="mt-1 text-lg font-semibold">{vendor.store.name}</h2></div><div className="text-right"><p className="font-semibold">{statusLabel(vendor.status)}</p><p className="mt-1 text-xs text-[var(--muted)]">{vendor.shippingServiceName}</p><p className="mt-1 text-sm tabular-nums">{money(vendor.totalMinor, vendor.order.currencyCode, vendor.order.currency.minorUnit, locale)}</p></div></div>
        <div className="mt-4 divide-y divide-[var(--border)]">{vendor.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{item.productName}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.sku}{item.variantName ? ` · ${item.variantName}` : ""} · {t("Qty", "الكمية")} {item.quantity}</p></div><strong className="tabular-nums">{money(item.lineTotalMinor, vendor.order.currencyCode, vendor.order.currency.minorUnit, locale)}</strong></div>)}</div>
        {vendor.order.address && <section className="mt-4 rounded-2xl border border-[var(--color-mint-200)] bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 text-sm shadow-[inset_0_1px_0_white]"><h3 className="font-bold text-[#655044]">{t("Delivery details", "بيانات التوصيل")}</h3><p className="mt-2 font-semibold text-[#655044]">{vendor.order.address.recipientName} · <a href={"tel:" + vendor.order.address.phone} className="underline decoration-dotted">{vendor.order.address.phone}</a></p><p className="mt-1 leading-6 text-[#64786c]">{[vendor.order.address.line1, vendor.order.address.line2, vendor.order.address.city, vendor.order.address.region, vendor.order.address.postalCode, vendor.order.address.countryName].filter(Boolean).join(" · ")}</p></section>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">{t("Marketplace payment state:", "حالة الدفع في السوق:")} {statusLabel(vendor.order.status)}.</p><div className="flex flex-wrap gap-2">{vendor.status === "CONFIRMED" && <button type="button" disabled={Boolean(savingOrderId)} onClick={() => updateOrderStatus(vendor.id, "PROCESSING")} className="rounded-xl bg-[var(--action)] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_9px_rgba(255,140,28,.18)] transition-colors hover:bg-[var(--action-hover)] disabled:opacity-50">{savingOrderId === vendor.id ? t("Saving…", "جارٍ الحفظ…") : t("Start processing", "بدء التجهيز")}</button>}{vendor.status === "PROCESSING" && <button type="button" disabled={savingOrderId === vendor.id} onClick={() => updateOrderStatus(vendor.id, "READY_TO_SHIP")} className="rounded-xl bg-[var(--action)] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_9px_rgba(255,140,28,.18)] transition-colors hover:bg-[var(--action-hover)] disabled:opacity-50">{savingOrderId === vendor.id ? t("Saving…", "جارٍ الحفظ…") : t("Mark ready to ship", "تحديد كجاهز للشحن")}</button>}{vendor.status === "PENDING_PAYMENT" && <span className="text-xs text-[var(--muted)]">{t("Waiting for verified payment.", "بانتظار تأكيد الدفع.")}</span>}{vendor.status === "READY_TO_SHIP" && !vendor.shipment && <div className="grid w-full gap-2 sm:grid-cols-2"><input aria-label={t("Carrier name", "اسم شركة الشحن")} value={shipmentDrafts[vendor.id]?.carrierName ?? ""} onChange={(event) => updateShipmentDraft(vendor.id, "carrierName", event.target.value)} placeholder={t("Carrier name", "اسم شركة الشحن")} maxLength={120} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs"/><input aria-label={t("Tracking number", "رقم التتبع")} value={shipmentDrafts[vendor.id]?.trackingNumber ?? ""} onChange={(event) => updateShipmentDraft(vendor.id, "trackingNumber", event.target.value)} placeholder={t("Tracking number", "رقم التتبع")} maxLength={160} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs"/><input aria-label={t("Tracking URL (optional)", "رابط التتبع (اختياري)")} value={shipmentDrafts[vendor.id]?.trackingUrl ?? ""} onChange={(event) => updateShipmentDraft(vendor.id, "trackingUrl", event.target.value)} placeholder={t("HTTPS tracking URL (optional)", "رابط تتبع HTTPS (اختياري)")} maxLength={2048} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs"/><button type="button" disabled={Boolean(savingOrderId) || !shipmentDrafts[vendor.id]?.carrierName?.trim() || !shipmentDrafts[vendor.id]?.trackingNumber?.trim()} onClick={() => dispatchOrder(vendor.id)} className="rounded-xl bg-[var(--action)] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_9px_rgba(255,140,28,.18)] transition-colors hover:bg-[var(--action-hover)] disabled:opacity-50">{savingOrderId === vendor.id ? t("Saving…", "جارٍ الحفظ…") : t("Record dispatch", "تسجيل الشحن")}</button></div>}</div></div>
        {vendor.shipment && <section className="mt-5 rounded-2xl bg-[var(--color-ivory-100)] p-4">
          <p className="text-sm font-semibold">{vendor.shipment.carrierName} · {vendor.shipment.trackingNumber}</p>{vendor.shipment.trackingUrl && <a href={vendor.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-xs font-semibold text-[var(--color-lavender-700)] underline">{t("Open carrier tracking", "فتح تتبع شركة الشحن")} ↗</a>}
          <p className="mt-1 text-xs text-[var(--muted)]">{t("Tracking status:", "حالة التتبع:")} {statusLabel(vendor.shipment.status)}</p>
          {vendor.shipment.status !== "DELIVERED" && <form onSubmit={(event) => void addTrackingEvent(event, vendor.id)} className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-xs">{t("Update", "تحديث")}<select name="status" required className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
              {({ SHIPPED: ["IN_TRANSIT", "EXCEPTION"], IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"], OUT_FOR_DELIVERY: ["DELIVERED", "EXCEPTION"], EXCEPTION: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] }[vendor.shipment.status as "SHIPPED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "EXCEPTION"] || []).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select></label>
            <label className="grid gap-1 text-xs">{t("Location", "الموقع")}<input name="location" maxLength={160} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs">{t("Update details", "تفاصيل التحديث")}<input name="description" maxLength={500} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" /></label>
            <button type="submit" disabled={Boolean(savingOrderId)} className="self-end rounded-xl bg-[var(--action)] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_9px_rgba(255,140,28,.18)] transition-colors hover:bg-[var(--action-hover)] disabled:opacity-50">{savingOrderId === vendor.id ? t("Saving…", "جارٍ الحفظ…") : t("Add tracking update", "إضافة تحديث تتبع")}</button>
          </form>}
          <ol className="mt-4 space-y-2">{vendor.shipment.events.map((event, index) => <li key={`${event.status}-${event.occurredAt}-${index}`} className="text-xs text-[var(--muted)]"><strong>{statusLabel(event.status)}</strong> · {new Date(event.occurredAt).toLocaleString(locale)}{event.location ? ` · ${event.location}` : ""}{event.description ? ` · ${event.description}` : ""}</li>)}</ol>
        </section>}

      </article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-8 text-center text-sm text-[var(--muted)]">{query ? t("No orders match this search.", "لا توجد طلبات تطابق هذا البحث.") : t("No seller orders yet.", "لا توجد طلبات للبائع بعد.")}</div> : null}
      {nextCursor && <div className="mt-6 text-center"><button type="button" onClick={() => void loadOlderOrders()} disabled={loadingMore || loading} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--color-ink-800)] shadow-clay-raised disabled:opacity-50">{loadingMore ? t("Loading older orders…", "جارٍ تحميل الطلبات الأقدم…") : t("Load older orders", "تحميل الطلبات الأقدم")}</button></div>}
    </div>
  </main>;
}
