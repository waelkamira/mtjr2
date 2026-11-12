"use client";

import { StatusBadge } from "@/components/status-badge";
import { formatMinorUnits } from "@/lib/money";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StoreReviewForm from "@/features/orders/store-review-form";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toast } from "sonner";

type PaymentProvider = { key: string; displayName: string };

type Order = {
  id: string; orderNumber: string; status: string; currencyCode: string;
  currency: { minorUnit: number; symbol: string | null };
  subtotalMinor: string; discountMinor: string; couponCode: string | null; shippingMinor: string; taxMinor: string; totalMinor: string; canCancel: boolean;
  statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
  tax: { ruleName: string; rateBasisPoints: number; inclusive: boolean; includesShipping: boolean; destinationRegion: string | null }; placedAt: string;
  address: { recipientName: string; phone: string; countryCode: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } | null;
  vendorOrders: Array<{
    id: string; status: string; store: { id: string; name: string; slug: string }; shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null;
    subtotalMinor: string; discountMinor: string; shippingMinor: string; taxMinor: string; totalMinor: string;
    statusHistory: Array<{ status: string; note: string | null; createdAt: string }>;
    shipment: null | {
      carrierName: string; trackingNumber: string; trackingUrl: string | null; status: string; shippedAt: string;
      events: Array<{ status: string; description: string | null; location: string | null; occurredAt: string }>;
    };
    items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: string; lineTotalMinor: string }>;
  }>;
};

function money(value: string, code: string, minorUnit: number) {
  return formatMinorUnits(value, code, minorUnit);
}

export default function OrderDetailPage({ orderId, returnedFromPayment }: { orderId: string; returnedFromPayment: boolean }) {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      PENDING_PAYMENT: ["Pending payment", "بانتظار الدفع"], PAID: ["Paid", "مدفوع"],
      PROCESSING: ["Processing", "قيد التجهيز"], READY_TO_SHIP: ["Ready to ship", "جاهز للشحن"],
      SHIPPED: ["Shipped", "تم الشحن"], IN_TRANSIT: ["In transit", "في الطريق"],
      OUT_FOR_DELIVERY: ["Out for delivery", "خرج للتوصيل"], DELIVERED: ["Delivered", "تم التوصيل"],
      COMPLETED: ["Completed", "مكتمل"], CANCELLED: ["Canceled", "ملغى"],
      EXCEPTION: ["Exception", "استثناء"], FAILED: ["Failed", "فشل"], REFUNDED: ["Refunded", "تم رد المبلغ"]
    };
    const [english, arabic] = labels[status] ?? [status.replaceAll("_", " "), status.replaceAll("_", " ")];
    return t(english, arabic);
  };
  const router = useRouter();
   const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [paymentBusy, setPaymentBusy] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [orderAction, setOrderAction] = useState<"cancel" | "reorder" | "">("");
  const [orderActionError, setOrderActionError] = useState("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function loadOrder(attempt = 0) {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" });
        const data = await response.json() as { order?: Order; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error || t("Order could not be loaded.", "تعذّر تحميل الطلب."));
        if (!active) return;
        setOrder(data.order);
        setError("");
        // Stripe redirects before its webhook is guaranteed to finish. Refresh briefly
        // until the server confirms payment; the browser return URL never marks an order paid.
        if (returnedFromPayment && data.order.status === "PENDING_PAYMENT" && attempt < 6) {
          timer = setTimeout(() => { void loadOrder(attempt + 1); }, 2000);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t("Order could not be loaded.", "تعذّر تحميل الطلب."));
      } finally {
        if (active && attempt === 0) setLoading(false);
      }
    }
    void loadOrder();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [orderId, returnedFromPayment, t]);

  useEffect(() => {
    let active = true;
    if (!order) return;
    const query = new URLSearchParams({ currency: order.currencyCode });
    if (order.address?.countryCode) query.set("country", order.address.countryCode);
    fetch("/api/payments/providers?" + query.toString(), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { providers?: PaymentProvider[] };
        if (active && response.ok) setPaymentProviders(data.providers || []);
      })
      .catch(() => { if (active) setPaymentProviders([]); });
    return () => { active = false; };
  }, [orderId, order?.currencyCode, order?.address?.countryCode]);

  async function startPayment(provider: PaymentProvider) {
    if (!order) return;
    setPaymentBusy(provider.key);
    setPaymentError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.key, idempotencyKey: crypto.randomUUID() })
      });
      const data = await response.json() as { payment?: { checkoutUrl: string | null }; error?: string };
      if (!response.ok || !data.payment) throw new Error(data.error || t("Payment could not be started.", "تعذّر بدء الدفع."));
      if (!data.payment.checkoutUrl) throw new Error(t("The payment session is being prepared. Refresh this page shortly.", "جلسة الدفع قيد الإعداد. حدّث الصفحة بعد قليل."));
      toast.success(t("Secure payment session created.", "تم إنشاء جلسة دفع آمنة."));
      window.location.assign(data.payment.checkoutUrl);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Payment could not be started.", "تعذّر بدء الدفع.");
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentBusy("");
    }
  }

  async function runOrderAction(action: "cancel" | "reorder") {
    if (!order) return;
    if (action === "cancel" && !window.confirm(t("Cancel this unpaid order and restore its reserved stock?", "هل تريد إلغاء هذا الطلب غير المدفوع وإعادة مخزونه المحجوز؟"))) return;
    setOrderAction(action);
    setOrderActionError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || (action === "cancel" ? t("Order cancellation failed.", "تعذّر إلغاء الطلب.") : t("Order reorder failed.", "تعذّرت إعادة الطلب.")));
      toast.success(action === "reorder" ? t("Items added to your cart.", "تمت إضافة المنتجات إلى سلتك.") : t("Order cancelled.", "تم إلغاء الطلب."));
      if (action === "reorder") router.push("/cart");
      else window.location.reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : (action === "cancel" ? t("Order cancellation failed.", "تعذّر إلغاء الطلب.") : t("Order reorder failed.", "تعذّرت إعادة الطلب."));
      setOrderActionError(message);
      toast.error(message);
    } finally {
      setOrderAction("");
    }
  }

  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--surface)] shadow-clay-raised px-5 py-5"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2"><Link href="/notifications" className="text-sm text-[var(--color-ink-600)]">{t("Notifications", "الإشعارات")}</Link><Link href="/account/orders" className="text-sm text-[var(--color-ink-600)]">{t("Order history", "سجل الطلبات")}</Link><Link href="/account/returns" className="text-sm text-[var(--color-ink-600)]">{t("Returns", "المرتجعات")}</Link></div></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10">
      {loading ? <div className="h-64 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : error ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-800">{error}</div> : order ? <>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Order details", "تفاصيل الطلب")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{order.status === "CANCELLED" ? t("This order was canceled", "تم إلغاء هذا الطلب") : order.status === "COMPLETED" ? t("Your order is complete", "اكتمل طلبك") : t("Thank you for your order", "شكرًا لطلبك")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("Order", "الطلب")} {order.orderNumber} · {new Date(order.placedAt).toLocaleString(locale)}</p>
        <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-6">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-[var(--muted)]">{t("Order status", "حالة الطلب")}</p><p className="mt-1 font-semibold"><StatusBadge locale={locale} status={order.status} /></p></div><div className="text-right"><p className="text-sm text-[var(--muted)]">{t("Total", "الإجمالي")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</p></div></div>
          <div className="mt-5 space-y-2 border-t border-[var(--border)] pt-4 text-sm"><div className="flex justify-between"><span className="text-[var(--muted)]">{t("Items", "المنتجات")}</span><strong>{money(order.subtotalMinor, order.currencyCode, order.currency.minorUnit)}</strong></div>{BigInt(order.discountMinor) > BigInt(0) && <div className="flex justify-between"><span className="text-[var(--muted)]">{t("Discount", "الخصم")}{order.couponCode ? ` · ${order.couponCode}` : ""}</span><strong>−{money(order.discountMinor, order.currencyCode, order.currency.minorUnit)}</strong></div>}<div className="flex justify-between"><span className="text-[var(--muted)]">{t("Shipping", "الشحن")}</span><strong>{money(order.shippingMinor, order.currencyCode, order.currency.minorUnit)}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">{t("Tax", "الضريبة")} · {order.tax.ruleName} ({(order.tax.rateBasisPoints / 100).toFixed(2)}%)</span><strong>{money(order.taxMinor, order.currencyCode, order.currency.minorUnit)}</strong></div><p className="text-xs text-[var(--muted)]">{order.tax.inclusive ? t("Included in listed prices", "مشمولة في الأسعار المعروضة") : t("Added to subtotal", "تُضاف إلى المجموع الفرعي")}{order.tax.destinationRegion ? ` · ${order.tax.destinationRegion}` : ""}</p></div>
          <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3 text-sm leading-6 text-[var(--muted)]">{order.status === "PENDING_PAYMENT" ? t("Your order has been recorded. Payment is pending; fulfillment remains locked until the provider verifies payment.", "تم تسجيل طلبك. الدفع قيد الانتظار، وسيظل التنفيذ متوقفًا حتى يتحقق مزود الخدمة من الدفع.") : order.status === "CANCELLED" ? t("This order was canceled before payment. Its stock was restored and any coupon redemption was released.", "أُلغي هذا الطلب قبل الدفع. أُعيد مخزونه وأُلغي استخدام أي قسيمة.") : t("Payment has been confirmed for this order.", "تم تأكيد الدفع لهذا الطلب.")}</p>
        </div>
        {order.status === "PENDING_PAYMENT" && <section className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-6">
          <h2 className="font-semibold text-[var(--color-ink-950)]">{t("Payment", "الدفع")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("Choose a configured payment method to continue. The order is confirmed only after the provider verifies payment.", "اختر طريقة دفع مُعدّة للمتابعة. لن يتم تأكيد الطلب إلا بعد تحقق مزود الخدمة من الدفع.")}</p>
          {paymentError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{paymentError}</p>}
          {paymentProviders.length ? <div className="mt-4 flex flex-wrap gap-3">{paymentProviders.map((provider) => <button key={provider.key} type="button" disabled={Boolean(paymentBusy)} onClick={() => void startPayment(provider)} className="rounded-xl bg-[var(--color-violet-600)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-violet-700)] disabled:opacity-50">{paymentBusy === provider.key ? t("Connecting…", "جارٍ الاتصال…") : `${t("Pay with", "الدفع عبر")} ${provider.displayName}`}</button>)}</div> : <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">{t("Online payment is not configured yet. Your order is safely awaiting payment; no charge has been made.", "لم يتم إعداد الدفع الإلكتروني بعد. طلبك بانتظار الدفع بأمان ولم يتم تحصيل أي مبلغ.")}</p>}
        </section>}
        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="font-semibold text-[var(--color-forest-950)]">{t("Order timeline", "الجدول الزمني للطلب")}</h2>
          <ol className="mt-4 space-y-4">{order.statusHistory.map((event, index) => <li key={`${event.status}-${event.createdAt}-${index}`} className="border-l-2 border-[var(--color-sage-300)] pl-4">
            <p className="text-sm font-semibold">{statusLabel(event.status)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString(locale)}{event.note ? ` · ${event.note}` : ""}</p>
          </li>)}</ol>
        </section>

        <section className="mt-6 space-y-4">{order.vendorOrders.map((vendor) => <article key={vendor.id} className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-[var(--muted)]">{t("Seller order", "طلب البائع")}</p><h2 className="mt-1 text-lg font-semibold">{vendor.store.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{vendor.shippingServiceName}{vendor.minDeliveryDays != null ? ` · ${vendor.minDeliveryDays}–${vendor.maxDeliveryDays ?? vendor.minDeliveryDays} ${t("days", "أيام")}` : ""}</p></div><p className="text-sm font-semibold">{statusLabel(vendor.status)}</p></div>
          <div className="mt-4 divide-y divide-[var(--border)]">{vendor.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-3"><div><p className="font-medium">{item.productName}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.sku}{item.variantName ? ` · ${item.variantName}` : ""} · {t("Qty", "الكمية")} {item.quantity}</p></div><p className="font-semibold tabular-nums">{money(item.lineTotalMinor, order.currencyCode, order.currency.minorUnit)}</p></div>)}</div>
          <ol className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">{vendor.statusHistory.map((event, index) => <li key={`${event.status}-${event.createdAt}-${index}`} className="text-xs text-[var(--muted)]"><strong className="text-[var(--color-forest-900)]">{statusLabel(event.status)}</strong> · {new Date(event.createdAt).toLocaleString(locale)}{event.note ? ` · ${event.note}` : ""}</li>)}</ol>
          {vendor.shipment && <section className="mt-4 rounded-2xl bg-[var(--color-ivory-100)] p-4">
            <h3 className="text-sm font-semibold">{t("Shipment tracking", "تتبع الشحنة")} · {vendor.shipment.carrierName}</h3>
            <p className="mt-1 text-sm">{vendor.shipment.trackingNumber} · {statusLabel(vendor.shipment.status)}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{t("Tracking details were entered by the seller; live carrier updates are not connected.", "أدخل البائع تفاصيل التتبع؛ تحديثات شركة الشحن المباشرة غير متصلة.")}</p>
            {vendor.shipment.trackingUrl && <a href={vendor.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-sm font-medium text-[var(--color-copper-700)] underline">{t("Open carrier tracking", "فتح تتبع شركة الشحن")}</a>}
            <ol className="mt-3 space-y-2">{vendor.shipment.events.map((event, index) => <li key={`${event.status}-${event.occurredAt}-${index}`} className="text-xs text-[var(--muted)]"><strong className="text-[var(--color-forest-900)]">{statusLabel(event.status)}</strong> · {new Date(event.occurredAt).toLocaleString(locale)}{event.location ? ` · ${event.location}` : ""}{event.description ? ` · ${event.description}` : ""}</li>)}</ol>
          </section>}
          <div className="mt-4 flex justify-between border-t border-[var(--border)] pt-4 text-sm"><span className="text-[var(--muted)]">{t("Seller order total", "إجمالي طلب البائع")}</span><strong>{money(vendor.totalMinor, order.currencyCode, order.currency.minorUnit)}</strong></div>
          {vendor.status === "DELIVERED" && <Link href="/account/returns" className="mt-4 inline-flex rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">{t("Request a return", "طلب إرجاع")}</Link>}{vendor.status === "DELIVERED" && <StoreReviewForm storeId={vendor.store.id} vendorOrderId={vendor.id} storeName={vendor.store.name} />}
        </article>)}</section>
        {orderActionError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{orderActionError}</p>}
        <section className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={Boolean(orderAction)} onClick={() => void runOrderAction("reorder")} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">{orderAction === "reorder" ? t("Adding items…", "جارٍ إضافة المنتجات…") : t("Order again", "اطلب مجددًا")}</button>
          {order.canCancel && <button type="button" disabled={Boolean(orderAction)} onClick={() => void runOrderAction("cancel")} className="rounded-xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-800 disabled:opacity-50">{orderAction === "cancel" ? t("Canceling…", "جارٍ الإلغاء…") : t("Cancel order", "إلغاء الطلب")}</button>}
          {order.status === "PENDING_PAYMENT" && !order.canCancel && <p className="self-center text-xs text-[var(--muted)]">{t("Cancellation is unavailable after a payment attempt has started.", "لا يمكن الإلغاء بعد بدء محاولة الدفع.")}</p>}
        </section>
        {order.address && <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-6"><h2 className="font-semibold">{t("Delivery address", "عنوان التوصيل")}</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{order.address.recipientName}<br />{order.address.phone}<br />{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}<br />{order.address.city}{order.address.region ? `, ${order.address.region}` : ""}{order.address.postalCode ? ` ${order.address.postalCode}` : ""}<br />{order.address.countryName}</p></section>}
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/products" className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{t("Continue shopping", "متابعة التسوق")}</Link><Link href="/account/orders" className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold">{t("View order history", "عرض سجل الطلبات")}</Link></div>
      </> : null}
    </div>
  </main>;
}
