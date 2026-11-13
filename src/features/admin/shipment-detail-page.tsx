"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import Link from "next/link";

type Shipment = {
  id: string; carrierName: string; trackingNumber: string; trackingUrl: string | null; status: string;
  shippedAt: string; deliveredAt: string | null; createdAt: string; updatedAt: string; checkedAt: string;
  vendorOrder: { id: string; status: string; store: { id: string; name: string; slug: string }; order: { id: string; orderNumber: string; status: string; placedAt: string; currencyCode: string; address: { countryCode: string; countryName: string } | null } };
  events: Array<{ id: string; status: string; description: string | null; location: string | null; occurredAt: string; actorId: string | null }>;
};

export default function AdminShipmentDetailPage({ shipmentId }: { shipmentId: string }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/shipments/${encodeURIComponent(shipmentId)}`, { cache: "no-store" });
        const result = await response.json() as { shipment?: Shipment; error?: string };
        if (!response.ok || !result.shipment) throw new Error(result.error || "Shipment details unavailable.");
        if (active) { setShipment(result.shipment); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Shipment details unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [shipmentId]);

  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8"><div className="mx-auto max-w-5xl">
    <Link href="/admin/logistics" className="text-sm font-semibold text-[#C65D0A] underline">{t("Back to shipments", "العودة إلى الشحنات")}</Link>
    {loading && <div className="mt-5 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {shipment && <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#C65D0A]">{t("Shipping operations", "عمليات الشحن")}</p><h1 className="mt-1 text-3xl font-semibold text-[var(--foreground)]">{shipment.carrierName}</h1><p className="mt-1 text-sm text-[var(--muted)]">{t("Tracking", "التتبع")} {shipment.trackingNumber} · {t("Shipment", "الشحنة")} {shipment.id}</p></div><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm font-semibold"><StatusBadge locale={locale} status={shipment.status} /></span></div>
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Order and store", "الطلب والمتجر")}</h2><p className="mt-3 text-sm"><Link href={`/admin/orders/${encodeURIComponent(shipment.vendorOrder.order.id)}`} className="font-semibold underline">{shipment.vendorOrder.order.orderNumber}</Link> · <StatusBadge locale={locale} status={shipment.vendorOrder.order.status} /></p><p className="mt-1 text-sm">{shipment.vendorOrder.store.name} · {t("vendor order", "طلب البائع")} {shipment.vendorOrder.id}</p><p className="mt-1 text-sm text-[var(--muted)]">{shipment.vendorOrder.order.address?.countryName || t("No destination country snapshot", "لا تتوفر بيانات بلد الوجهة")}</p></article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Shipment record", "سجل الشحنة")}</h2><dl className="mt-3 space-y-2 text-sm"><div>{t("Shipped:", "تاريخ الشحن:")} {new Date(shipment.shippedAt).toLocaleString()}</div><div>{t("Delivered:", "تاريخ التسليم:")} {shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString() : t("Not recorded", "لم يُسجل")}</div><div>{t("Record created:", "تاريخ إنشاء السجل:")} {new Date(shipment.createdAt).toLocaleString()}</div><div>{t("Last updated:", "آخر تحديث:")} {new Date(shipment.updatedAt).toLocaleString()}</div></dl>{shipment.trackingUrl && <p className="mt-2 break-all text-xs text-[var(--muted)]">{t("Carrier tracking URL:", "رابط تتبع شركة الشحن:")} {shipment.trackingUrl}</p>}</article>
      </section>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Recorded tracking events", "أحداث التتبع المسجلة")}</h2>{shipment.events.length ? <ol className="mt-4 space-y-4">{shipment.events.map((event) => <li key={event.id} className="border-l-2 border-[var(--color-copper-600)] pl-4"><p className="text-sm font-semibold"><StatusBadge locale={locale} status={event.status} /></p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(event.occurredAt).toLocaleString()}{event.location ? ` · ${event.location}` : ""}{event.actorId ? ` · ${t("recorded by", "سجل بواسطة")} ${event.actorId}` : ""}</p>{event.description && <p className="mt-1 text-sm">{event.description}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-[var(--muted)]">{t("No tracking events have been recorded.", "لم يتم تسجيل أحداث تتبع.")}</p>}</section>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t("Carrier status automation, delay detection, and delivery exception workflows are not configured. Displayed events are persisted records only.", "لم تتم تهيئة الأتمتة لحالات شركة الشحن أو اكتشاف التأخير أو معالجة استثناءات التسليم. الأحداث المعروضة هي السجلات المحفوظة فقط.")}</p>
    </>}
  </div></main>;
}
