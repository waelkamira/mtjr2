"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Market = { id: string; code: string; name: string };
type TaxRate = { id: string; market: Market; name: string; destinationRegion: string | null; rateBasisPoints: number; isInclusive: boolean; appliesToShipping: boolean; isActive: boolean };

async function json(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function AdminTaxRatesPage() {
  const { locale } = useLocale();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [marketId, setMarketId] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [percent, setPercent] = useState("0");
  const [inclusive, setInclusive] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [marketData, rateData] = await Promise.all([
      json(await fetch("/api/markets", { cache: "no-store" })),
      json(await fetch("/api/admin/tax-rates", { cache: "no-store" }))
    ]);
    return {
      markets: (marketData.markets || []) as Market[],
      rates: (rateData.rates || []) as TaxRate[]
    };

  }, []);

  useEffect(() => {
    let active = true;
    void load().then((data) => {
      if (!active) return;
      setMarkets(data.markets);
      setRates(data.rates);
      setMarketId((current) => current || data.markets[0]?.id || "");
    }).catch((cause) => {

      if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load tax rules.", "تعذر تحميل قواعد الضرائب."));
    });
    return () => { active = false; };
  }, [load, locale]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const value = Number(percent);
      if (!Number.isFinite(value) || value < 0 || value > 1000) throw new Error(translate(locale, "Enter a tax rate from 0% to 1000%.", "أدخل معدل ضريبة من 0٪ إلى 1000٪."));
      await json(await fetch("/api/admin/tax-rates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, name, destinationRegion: region || null, rateBasisPoints: Math.round(value * 100), isInclusive: inclusive, appliesToShipping: shipping })
      }));
      setMessage(translate(locale, "Tax rule created.", "تم إنشاء قاعدة الضريبة.")); setName(""); setRegion(""); setPercent("0");
      const data = await load();
      setMarkets(data.markets);
      setRates(data.rates);
      setMarketId((current) => current || data.markets[0]?.id || "");

    } catch (cause) { setError(cause instanceof Error ? cause.message : translate(locale, "Unable to create tax rule.", "تعذر إنشاء قاعدة الضريبة.")); }
    finally { setBusy(false); }
  }

  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto min-h-screen w-full max-w-[1600px] bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--color-orange-600)]">{translate(locale, "Platform settings", "إعدادات المنصة")}</p><h1 className="mt-1 text-3xl font-bold text-[var(--color-ink-950)]">{translate(locale, "Market tax rules", "قواعد ضرائب السوق")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{translate(locale, "Configure a market-wide tax rate, optionally narrowed to a destination region. These are explicit platform rules, not automatically sourced statutory rates.", "اضبط معدل ضريبة على مستوى السوق، ويمكن تخصيصه لمنطقة وجهة. هذه قواعد محددة للمنصة وليست معدلات قانونية مستمدة تلقائيًا.")}</p></div><span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">{translate(locale, "Syria marketplace", "السوق السورية")}</span></div>
    <div className="mx-auto max-w-5xl">
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{message}</p>}
      <form onSubmit={submit} className="mt-7 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-clay-raised md:grid-cols-2">
        <input type="hidden" name="marketId" value={marketId} />
        <label className="grid gap-2 text-sm">{translate(locale, "Rule name", "اسم القاعدة")}<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink-950)] shadow-sm outline-none focus:border-[var(--color-orange-500)] focus:ring-2 focus:ring-orange-100" placeholder={translate(locale, "Standard VAT", "ضريبة القيمة المضافة القياسية")} /></label>
        <label className="grid gap-2 text-sm">{translate(locale, "Destination region (optional)", "منطقة الوجهة (اختياري)")}<input maxLength={120} value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl border border-[var(--border)] p-3" placeholder={translate(locale, "Region/state exactly as entered in address", "المنطقة أو الولاية كما تظهر تمامًا في العنوان")} /></label>
        <label className="grid gap-2 text-sm">{translate(locale, "Rate (%)", "المعدل (٪)")}<input required type="number" min="0" max="1000" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="rounded-xl border border-[var(--border)] p-3" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} /> {translate(locale, "Tax is included in listed prices", "الضريبة مشمولة في الأسعار المعروضة")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shipping} onChange={(e) => setShipping(e.target.checked)} /> {translate(locale, "Apply tax to shipping", "تطبيق الضريبة على الشحن")}</label>
        <button disabled={busy || !marketId} className="rounded-lg bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Create tax rule", "إنشاء قاعدة ضريبية")}</button>
      </form>
      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-clay-raised">
        <h2 className="text-lg font-semibold">{translate(locale, "Configured rules", "القواعد المضبوطة")}</h2>
        <div className="mt-4 divide-y divide-[var(--border)]">{rates.map((rate) => <article key={rate.id} className="flex flex-wrap justify-between gap-3 py-4 first:pt-0"><div><p className="font-semibold">{rate.name} · {translate(locale, "Syria", "سوريا")}</p><p className="mt-1 text-xs text-[var(--muted)]">{rate.destinationRegion || translate(locale, "All regions", "كل المناطق")} · {rate.isInclusive ? translate(locale, "Inclusive", "شاملة") : translate(locale, "Exclusive", "غير شاملة")} · {rate.appliesToShipping ? translate(locale, "Shipping taxable", "تشمل الشحن") : translate(locale, "Items only", "المنتجات فقط")}</p></div><p className="font-semibold tabular-nums">{(rate.rateBasisPoints / 100).toFixed(2)}%</p></article>)}
          {!rates.length && <p className="py-5 text-sm text-[var(--muted)]">{translate(locale, "No tax rules configured.", "لم يتم ضبط أي قواعد ضريبية.")}</p>}</div>
      </section>
    </div>
  </main>;
}
