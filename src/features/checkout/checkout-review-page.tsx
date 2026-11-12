"use client";

import { formatMinorUnits } from "@/lib/money";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CheckoutDeliveryAddress from "@/features/checkout/checkout-delivery-address";
import CheckoutShippingOptions from "@/features/checkout/checkout-shipping-options";
import CheckoutTaxSummary from "@/features/checkout/checkout-tax-summary";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";

type Quote = {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "RELEASED" | "CONVERTED";
  market: { code: string; name: string };
  currency: { code: string; symbol: string | null; minorUnit: number };
  subtotalMinor: string;
  couponCode: string | null;
  discountMinor: string;
  expiresAt: string;
  lines: Array<{ id: string; productName: string; storeName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: string; lineTotalMinor: string }>;
};

function money(amountMinor: string, code: string, minorUnit: number) {
  return formatMinorUnits(amountMinor, code, minorUnit);
}

export default function CheckoutReviewPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const search = useSearchParams();
  const router = useRouter();
  const quoteId = search.get("quoteId");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!quoteId) return;
    fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { quote?: Quote; error?: string };
        if (!response.ok || !result.quote) throw new Error(result.error || t("Checkout quote could not be loaded.", "تعذّر تحميل عرض الشراء."));
        if (active) setQuote(result.quote);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("Checkout quote could not be loaded.", "تعذّر تحميل عرض الشراء.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quoteId, t]);

  async function releaseQuote() {
    if (!quote) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quote.id)}/release`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || t("The reservation could not be released.", "تعذّر إلغاء الحجز."));
      toast.success(t("Reservation released.", "تم تحرير الحجز."));
      router.push("/cart");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("The reservation could not be released.", "تعذّر إلغاء الحجز.");
      setError(message);
      toast.error(message);
    } finally { setBusy(false); }
  }

  async function placeOrder() {
    if (!quote) return;
    setPlacingOrder(true);
    setError("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quote.id)}/place-order`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
      });
      const result = await response.json() as { order?: { id: string }; error?: string };
      if (!response.ok || !result.order) throw new Error(result.error || t("The order could not be placed.", "تعذّر تقديم الطلب."));
      toast.success(t("Your order has been placed.", "تم تقديم طلبك بنجاح."));
      router.push(`/orders/${encodeURIComponent(result.order.id)}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("The order could not be placed.", "تعذّر تقديم الطلب.");
      setError(message);
      toast.error(message);
    } finally { setPlacingOrder(false); }
  }

  const displayError = error || (!quoteId ? t("A checkout quote is required. Return to your cart to review it.", "يلزم وجود عرض شراء. عُد إلى سلتك لمراجعته.") : "");
  const isLoading = Boolean(quoteId) && loading;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 px-3 py-4 sm:px-5 sm:py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link>
          <Link href="/cart" className="text-sm text-[var(--color-ink-600)]">{t("Back to cart", "العودة إلى السلة")}</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-5 sm:py-10 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{t("Buying core · Step 2", "إتمام الشراء · الخطوة ٢")}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl text-[var(--color-ink-950)]">{t("Review your order", "مراجعة طلبك")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("This is a server-generated price quote. Available inventory is temporarily held while the quote is active.", "هذا عرض سعر أنشأه الخادم. يُحجز المخزون المتاح مؤقتًا ما دام العرض نشطًا.")}</p>
        {displayError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-[var(--color-danger)]">{displayError}</p>}
        {isLoading ? <div className="mt-8 h-56 animate-pulse rounded-2xl bg-[var(--surface-soft)]" /> :
          quote ? <><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
              <div className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4">
                <p className="font-semibold text-[var(--color-ink-950)]">{quote.market.name}</p>
                <p className="break-all text-xs text-[var(--muted)]">{t("Quote reference", "مرجع عرض السعر")} · {quote.id}</p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {quote.lines.map((line) => <article key={line.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-ink-950)]">{line.productName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t("Sold by", "يُباع بواسطة")} {line.storeName}{line.variantName ? ` · ${line.variantName}` : ""} · {t("Qty", "الكمية")} {line.quantity}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">SKU {line.sku}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{money(line.unitAmountMinor, quote.currency.code, quote.currency.minorUnit)} {t("each", "للوحدة")}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{money(line.lineTotalMinor, quote.currency.code, quote.currency.minorUnit)}</p>
                </article>)}
              </div>
            </section>
            <aside className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold text-[var(--color-ink-950)]">{t("Quote summary", "ملخص عرض السعر")}</p>
              <div className="mt-5 flex justify-between gap-3 text-sm"><span className="text-[var(--muted)]">{t("Items subtotal", "المجموع الفرعي للمنتجات")}</span><span className="font-semibold tabular-nums">{money(quote.subtotalMinor, quote.currency.code, quote.currency.minorUnit)}</span></div>
              {BigInt(quote.discountMinor) > BigInt(0) && <div className="mt-3 flex justify-between gap-3 text-sm"><span>{t("Coupon", "القسيمة")}{quote.couponCode ? ` · ${quote.couponCode}` : ""}</span><span className="font-semibold tabular-nums">−{money(quote.discountMinor, quote.currency.code, quote.currency.minorUnit)}</span></div>}
              <div className="mt-4 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--muted)]">{t("Reservation status", "حالة الحجز")}</p><div className="mt-1"><StatusBadge locale={locale} status={quote.status} /></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{quote.status === "ACTIVE" ? t(`Stock held until ${new Date(quote.expiresAt).toLocaleString()}.`, `المخزون محجوز حتى ${new Date(quote.expiresAt).toLocaleString()}.`) : t("This quote is no longer holding inventory. Return to your cart to create a fresh quote.", "لم يعد هذا العرض يحجز المخزون. عُد إلى سلتك لإنشاء عرض جديد.")}</p></div>
              <button type="button" disabled={busy || quote.status !== "ACTIVE"} onClick={() => void releaseQuote()} className="mt-6 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{busy ? t("Releasing…", "جارٍ الإلغاء…") : t("Release reservation", "إلغاء الحجز")}</button>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{t("No order has been created and no payment has been taken.", "لم يُنشأ أي طلب ولم يتم تحصيل أي مبلغ.")}</p>
            </aside>
          </div>
          <div className="mt-6"><CheckoutDeliveryAddress quoteId={quote.id} quoteStatus={quote.status} /></div>
          <div className="mt-4"><CheckoutShippingOptions quoteId={quote.id} currencyCode={quote.currency.code} minorUnit={quote.currency.minorUnit} quoteStatus={quote.status} /></div>
          <div className="mt-4"><CheckoutTaxSummary quoteId={quote.id} currencyCode={quote.currency.code} minorUnit={quote.currency.minorUnit} quoteStatus={quote.status} /></div>
          <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-sm leading-6 text-[var(--muted)]">{t("Placing the order creates one marketplace order and separate seller orders. Payment is not collected in this step.", "يؤدي تقديم الطلب إلى إنشاء طلب للسوق وطلبات منفصلة للبائعين. لا يتم تحصيل الدفع في هذه الخطوة.")}</p><button type="button" disabled={placingOrder || quote.status !== "ACTIVE"} onClick={() => void placeOrder()} className="mt-4 w-full rounded-xl bg-[var(--color-ink-800)] px-5 py-4 text-sm font-semibold text-white disabled:opacity-50">{placingOrder ? t("Placing order…", "جارٍ تقديم الطلب…") : t("Place order", "قدّم الطلب")}</button></div>
          <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--muted)]">{t("Order creation requires a delivery address, a shipping selection for each seller, and a configured tax calculation. Payment integration remains pending.", "يتطلب إنشاء الطلب عنوان توصيل واختيار شحن لكل بائع واحتساب الضريبة. تكامل الدفع غير متاح بعد.")}</div></>
          : <div className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center"><p className="font-semibold text-[var(--color-ink-950)]">{t("Checkout quote unavailable", "عرض الشراء غير متاح")}</p><Link href="/cart" className="mt-4 inline-flex rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white">{t("Return to cart", "العودة إلى السلة")}</Link></div>
        }
      </div>
    </main>
  );
}
