"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type TaxResult = {
  configured: boolean;
  requiresShippingSelection?: boolean;
  message?: string;
  rule?: { name: string; rateBasisPoints: number; isInclusive: boolean; includesShipping: boolean };
  subtotalMinor?: string;
  couponCode?: string | null;
  discountMinor?: string;
  shippingMinor?: string;
  taxableAmountMinor?: string;
  taxAmountMinor?: string;
  amountDueMinor?: string;
  currencyCode?: string;
  minorUnit?: number;
};

export default function CheckoutTaxSummary({ quoteId, quoteStatus, currencyCode, minorUnit }: { quoteId: string; quoteStatus: string; currencyCode: string; minorUnit: number }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function money(value?: string) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(Number(value || "0") / (10 ** minorUnit));
  }
  async function calculate() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}/tax`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { tax?: TaxResult; error?: string };
      if (!response.ok || !data.tax) throw new Error(data.error || t("Tax could not be calculated.", "تعذّر احتساب الضريبة."));
      setResult(data.tax);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Tax could not be calculated.", "تعذّر احتساب الضريبة.")); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] md:p-6">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-copper-600)]">{t("Checkout totals", "إجمالي الشراء")}</p>
    <h2 className="mt-1 text-lg font-semibold text-[var(--color-forest-950)]">{t("Tax calculation", "احتساب الضريبة")}</h2>
    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t("Tax is calculated from the configured market and destination rule after shipping is selected. No rate is assumed when none is configured.", "تُحتسب الضريبة وفق إعدادات السوق ووجهة التوصيل بعد اختيار الشحن. لا يُفترض أي معدل عند عدم إعداد قاعدة ضريبية.")}</p>
    <button type="button" disabled={quoteStatus !== "ACTIVE" || busy} onClick={() => void calculate()} className="mt-4 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Calculating…", "جارٍ الاحتساب…") : t("Calculate tax and total", "احسب الضريبة والإجمالي")}</button>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result && <div role="status" aria-live="polite" className="mt-4 border-t border-[var(--border)] pt-4">
      {!result.configured ? <p className="text-sm text-[var(--muted)]">{result.message}</p> : <>
        <p className="text-sm text-[var(--muted)]">{result.rule?.name} · {(Number(result.rule?.rateBasisPoints || 0) / 100).toFixed(2)}% · {result.rule?.isInclusive ? t("Tax inclusive", "الضريبة مشمولة") : t("Tax exclusive", "الضريبة غير مشمولة")}</p>
        <div className="mt-3 space-y-2 text-sm">
          {Number(result.discountMinor || "0") > 0 && <div className="flex justify-between"><span>{t("Coupon", "قسيمة")}{result.couponCode ? ` · ${result.couponCode}` : ""}</span><strong>−{money(result.discountMinor)}</strong></div>}
          <div className="flex justify-between"><span>{t("Shipping", "الشحن")}</span><strong>{money(result.shippingMinor)}</strong></div>
          <div className="flex justify-between"><span>{t("Tax", "الضريبة")}</span><strong>{money(result.taxAmountMinor)}</strong></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-3 text-base"><span className="font-semibold">{t("Estimated total", "الإجمالي التقديري")}</span><strong>{money(result.amountDueMinor)}</strong></div>
        </div>
      </>}
    </div>}
  </section>;
}
