"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import Link from "next/link";

type AdminOrder = {
  id: string; orderNumber: string; status: string; currencyCode: string; currency: { minorUnit: number }; subtotalMinor: string; couponCode: string | null;
  discountMinor: string; shippingMinor: string; taxMinor: string; taxRuleName: string; taxRateBasisPoints: number;
  taxInclusive: boolean; taxIncludesShipping: boolean; taxDestinationRegion: string | null; totalMinor: string; placedAt: string;
  user: { id: string; email: string; displayName: string | null } | null;
  address: { recipientName: string; phone: string; countryCode: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } | null;
  statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
  payments: Array<{ id: string; provider: string; status: string; amountMinor: string; currencyCode: string; currency: { minorUnit: number }; createdAt: string; succeededAt: string | null }>;
  vendorOrders: Array<{
    id: string; status: string; subtotalMinor: string; discountMinor: string; shippingMinor: string; taxMinor: string;
    taxInclusive: boolean; shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null;
    maxDeliveryDays: number | null; totalMinor: string; createdAt: string;
    store: { id: string; name: string; slug: string; seller: { id: string; displayName: string | null; legalName: string | null } };
    items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: string; lineTotalMinor: string }>;
    statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
    shipment: null | { carrierName: string; trackingNumber: string; trackingUrl: string | null; status: string; shippedAt: string; deliveredAt: string | null; events: Array<{ status: string; description: string | null; location: string | null; occurredAt: string }> };
  }>;
};

function money(amount: string, currency: string, minorUnit: number) {
  const value = BigInt(amount);
  const divisor = BigInt(10) ** BigInt(minorUnit);
  const whole = value / divisor;
  const fraction = minorUnit ? `.${(value % divisor).toString().padStart(minorUnit, "0")}` : "";
  return `${currency} ${new Intl.NumberFormat().format(whole)}${fraction}`;
}

export default function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" });
        const result = await response.json() as { order?: AdminOrder; error?: string };
        if (!response.ok || !result.order) throw new Error(result.error || "Order details unavailable.");
        if (active) { setOrder(result.order); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Order details unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [orderId]);

  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/admin/orders" className="text-sm font-semibold text-[#C65D0A] underline">{t("Back to orders", "العودة إلى الطلبات")}</Link>
    {loading && <div className="mt-5 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {order && <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#C65D0A]">{t("Order operations", "إدارة الطلب")}</p><h1 className="mt-1 text-3xl font-semibold text-[var(--foreground)]">{order.orderNumber}</h1><p className="mt-1 text-sm text-[var(--muted)]">{order.id} · {t("Placed", "تاريخ الطلب")} {new Date(order.placedAt).toLocaleString(locale === "ar" ? "ar" : "en")}</p></div><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-sm font-semibold"><StatusBadge locale={locale} status={order.status} /></span></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Customer", "العميل")}</h2>{order.user ? <><p className="mt-2">{order.user.displayName || t("No display name", "لا يوجد اسم معروض")}</p><p className="text-sm text-[var(--muted)]">{order.user.email}</p><Link href={`/admin/users/${encodeURIComponent(order.user.id)}`} className="mt-2 inline-block text-sm font-semibold underline">{t("View account", "عرض الحساب")}</Link></> : <p className="mt-2 text-sm text-[var(--muted)]">{t("Guest checkout", "شراء كضيف")}</p>}</section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Delivery address", "عنوان التوصيل")}</h2>{order.address ? <address className="mt-2 not-italic text-sm leading-6">{order.address.recipientName}<br />{order.address.phone}<br />{order.address.line1}{order.address.line2 && <><br />{order.address.line2}</>}<br />{[order.address.city, order.address.region, order.address.postalCode].filter(Boolean).join(", ")}<br />{order.address.countryName} ({order.address.countryCode})</address> : <p className="mt-2 text-sm text-[var(--muted)]">{t("No address snapshot", "لا تتوفر نسخة من العنوان")}</p>}</section>
      </div>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Order totals", "إجمالي الطلب")} · {order.currencyCode}</h2><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div>{t("Subtotal:", "المجموع الفرعي:")} {money(order.subtotalMinor, order.currencyCode, order.currency.minorUnit)}</div><div>{t("Discount", "الخصم")}{order.couponCode ? ` (${order.couponCode})` : ""}: {money(order.discountMinor, order.currencyCode, order.currency.minorUnit)}</div><div>{t("Shipping:", "الشحن:")} {money(order.shippingMinor, order.currencyCode, order.currency.minorUnit)}</div><div>{t("Tax:", "الضريبة:")} {money(order.taxMinor, order.currencyCode, order.currency.minorUnit)} · {order.taxRuleName}</div><div className="font-semibold">{t("Total:", "الإجمالي:")} {money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</div><div>Tax {order.taxRateBasisPoints / 100}% · {order.taxInclusive ? t("inclusive", "شاملة") : t("exclusive", "غير شاملة")}{order.taxIncludesShipping ? t(", includes shipping", "، تشمل الشحن") : ""}{order.taxDestinationRegion ? ` · ${order.taxDestinationRegion}` : ""}</div></dl></section>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Payment attempts", "محاولات الدفع")}</h2>{order.payments.length ? <div className="mt-3 space-y-3">{order.payments.map((payment) => <div key={payment.id} className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-3 text-sm"><div><p>{payment.provider} · <StatusBadge locale={locale} status={payment.status} /></p><p className="text-xs text-[var(--muted)]">{payment.id} · {new Date(payment.createdAt).toLocaleString()}</p></div><p>{money(payment.amountMinor, payment.currencyCode, payment.currency.minorUnit)}{payment.succeededAt ? ` · ${t("succeeded", "ناجحة")} ${new Date(payment.succeededAt).toLocaleString(locale === "ar" ? "ar" : "en")}` : ""}</p></div>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">{t("No payment attempts recorded. This order has not been charged by the platform.", "لا توجد محاولات دفع مسجلة. لم تخصم المنصة أي مبلغ لهذا الطلب.")}</p>}</section>
      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-semibold">{t("Order status history", "سجل حالات الطلب")}</h2>{order.statusHistory.length ? <ol className="mt-3 space-y-3">{order.statusHistory.map((event, index) => <li key={`${event.createdAt}-${index}`} className="border-l-2 border-[#FF8C1C] pl-3"><p className="text-sm font-semibold"><StatusBadge locale={locale} status={event.status} /></p><p className="text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</p></li>)}</ol> : <p className="mt-2 text-sm text-[var(--muted)]">{t("No order status events recorded.", "لا توجد أحداث مسجلة لحالة الطلب.")}</p>}</section>
      <div className="mt-4 space-y-4">{order.vendorOrders.map((vendor) => <section key={vendor.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-semibold">{vendor.store.name} · <StatusBadge locale={locale} status={vendor.status} /></h2><p className="text-xs text-[var(--muted)]">{t("Vendor order", "طلب البائع")} {vendor.id} · Seller {vendor.store.seller.displayName || vendor.store.seller.legalName || vendor.store.seller.id}</p></div><p className="font-semibold">{money(vendor.totalMinor, order.currencyCode, order.currency.minorUnit)}</p></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-start text-sm"><thead><tr className="border-b text-xs text-[var(--muted)]"><th className="py-2">{t("Item", "المنتج")}</th><th>{t("SKU", "رمز المنتج")}</th><th>{t("Qty", "الكمية")}</th><th>{t("Unit", "سعر الوحدة")}</th><th>{t("Line total", "إجمالي السطر")}</th></tr></thead><tbody>{vendor.items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-2">{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{money(item.unitAmountMinor, order.currencyCode, order.currency.minorUnit)}</td><td>{money(item.lineTotalMinor, order.currencyCode, order.currency.minorUnit)}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-sm text-[var(--muted)]">{t("Shipping", "الشحن")} {money(vendor.shippingMinor, order.currencyCode, order.currency.minorUnit)} · {t("Tax", "الضريبة")} {money(vendor.taxMinor, order.currencyCode, order.currency.minorUnit)} · {vendor.shippingServiceName}{vendor.shippingDestinationRegion ? ` ${t("to", "إلى")} ${vendor.shippingDestinationRegion}` : ""}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><h3 className="text-sm font-semibold">{t("Vendor status history", "سجل حالات البائع")}</h3>{vendor.statusHistory.length ? <ol className="mt-2 space-y-2">{vendor.statusHistory.map((event, index) => <li key={`${event.createdAt}-${index}`} className="text-sm"><StatusBadge locale={locale} status={event.status} /><span className="block text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</span></li>)}</ol> : <p className="mt-2 text-sm text-[var(--muted)]">{t("No status events.", "لا توجد أحداث حالة.")}</p>}</div>
          <div><h3 className="text-sm font-semibold">{t("Shipment", "الشحنة")}</h3>{vendor.shipment ? <><p className="mt-2 text-sm">{vendor.shipment.carrierName} · <StatusBadge locale={locale} status={vendor.shipment.status} /> · {vendor.shipment.trackingNumber}</p>{vendor.shipment.trackingUrl && <a href={vendor.shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-sm text-[#C65D0A] underline">{t("Open tracking", "فتح التتبع")}</a>}{vendor.shipment.events.map((event, index) => <p key={`${event.occurredAt}-${index}`} className="mt-2 text-xs text-[var(--muted)]"><StatusBadge locale={locale} status={event.status} /> · {new Date(event.occurredAt).toLocaleString()}{event.location ? ` · ${event.location}` : ""}{event.description ? ` · ${event.description}` : ""}</p>)}</> : <p className="mt-2 text-sm text-[var(--muted)]">{t("No shipment recorded.", "لم يتم تسجيل شحنة.")}</p>}</div>
        </div>
      </section>)}</div>
    </>}
  </div></main>;
}
