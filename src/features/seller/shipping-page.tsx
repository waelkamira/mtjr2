"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { formatMinorUnits, toMinorUnits } from "@/lib/money";

type Store = { id: string; name: string; markets: Array<{ market: { id: string; code: string; name: string; defaultCurrencyCode: string } }> };
type Market = { id: string; code: string; name: string; defaultCurrency: { code: string }; currencies: Array<{ currency: { code: string; name: string; minorUnit: number } }> };
type Rate = { id: string; marketId: string; market: { code: string; name: string }; currencyCode: string; currency: { minorUnit: number }; name: string; description: string | null; amountMinor: string; destinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null; isActive: boolean; priority: number };
type Draft = { marketId: string; currencyCode: string; name: string; description: string; amount: string; destinationRegion: string; minDeliveryDays: string; maxDeliveryDays: string; priority: string; isActive: boolean };
const emptyDraft: Draft = { marketId: "", currencyCode: "", name: "", description: "", amount: "", destinationRegion: "", minDeliveryDays: "", maxDeliveryDays: "", priority: "0", isActive: true };

function minorUnitsToInput(amountMinor: string, minorUnit: number): string {
  const amount = BigInt(amountMinor);
  const scale = BigInt(10) ** BigInt(minorUnit);
  const whole = amount / scale;
  if (minorUnit === 0) return whole.toString();
  const fraction = (amount % scale).toString().padStart(minorUnit, "0");
  return whole.toString() + "." + fraction;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

export default function SellerShippingPage() {
  const { locale } = useLocale();
  const [stores, setStores] = useState<Store[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [storeId, setStoreId] = useState("");
  const [rates, setRates] = useState<Rate[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const enabledMarkets = useMemo(() => {
    const enabled = new Set(stores.find((store) => store.id === storeId)?.markets.map((entry) => entry.market.id) ?? []);
    return markets.filter((market) => enabled.has(market.id));
  }, [markets, storeId, stores]);

  const loadRates = useCallback(async (id: string) => {
    if (!id) { setRates([]); return; }
    const result = await readJson<{ rates: Rate[] }>(await fetch(`/api/seller/shipping-rates?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }));
    setRates(result.rates);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const [workspace, marketResult] = await Promise.all([
          fetch("/api/seller/stores", { cache: "no-store" }).then((r) => readJson<{ stores: Store[] }>(r)),
          fetch("/api/markets", { cache: "no-store" }).then((r) => readJson<{ items: Market[] }>(r))
        ]);
        if (!active) return;
        setStores(workspace.stores);
        setMarkets(marketResult.items);
        let savedId = "";
        try { savedId = localStorage.getItem("mtjr.activeStoreId") || ""; } catch { /* Keep the page usable when browser storage is blocked. */ }
        const initialStore = workspace.stores.find((item) => item.id === savedId) ?? workspace.stores[0];
        if (initialStore) {
          setStoreId(initialStore.id);
          const enabledIds = new Set(initialStore.markets.map((entry) => entry.market.id));
          const firstMarket = marketResult.items.find((market) => enabledIds.has(market.id));
          setDraft({ ...emptyDraft, marketId: firstMarket?.id ?? "", currencyCode: firstMarket ? (firstMarket.currencies.some((entry) => entry.currency.code === "SYP") ? "SYP" : firstMarket.defaultCurrency.code) : "" });
          try { localStorage.setItem("mtjr.activeStoreId", initialStore.id); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Store selection still works for this session. */ }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load shipping settings.", "تعذر تحميل إعدادات الشحن."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    void Promise.resolve().then(() => loadRates(storeId)).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load shipping rates.", "تعذر تحميل أسعار الشحن."));
    });
    return () => { active = false; };
  }, [locale, loadRates, storeId]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(rate: Rate) {
    setEditingId(rate.id);
    setDraft({
      marketId: rate.marketId, currencyCode: rate.currencyCode, name: rate.name,
      description: rate.description ?? "", amount: minorUnitsToInput(rate.amountMinor, rate.currency.minorUnit),
      destinationRegion: rate.destinationRegion ?? "",
      minDeliveryDays: rate.minDeliveryDays?.toString() ?? "",
      maxDeliveryDays: rate.maxDeliveryDays?.toString() ?? "",
      priority: rate.priority.toString(), isActive: rate.isActive
    });
  }

  function resetForm() {
    setEditingId("");
    setDraft({ ...emptyDraft, marketId: enabledMarkets[0]?.id ?? "", currencyCode: enabledMarkets[0] ? (enabledMarkets[0].currencies.some((entry) => entry.currency.code === "SYP") ? "SYP" : enabledMarkets[0].defaultCurrency.code) : "" });
  }

  function selectStore(id: string) {
    setStoreId(id);
    try { localStorage.setItem("mtjr.activeStoreId", id); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Store selection still works for this session. */ }
    const store = stores.find((item) => item.id === id);
    const enabledIds = new Set(store?.markets.map((entry) => entry.market.id) ?? []);
    const firstMarket = markets.find((market) => enabledIds.has(market.id));
    setEditingId("");
    setDraft({ ...emptyDraft, marketId: firstMarket?.id ?? "", currencyCode: firstMarket?.defaultCurrency.code ?? "" });
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    setSaving(true);
    setError("");
    try {
      const selectedCurrency = enabledMarkets
        .find((market) => market.id === draft.marketId)?.currencies
        .find((entry) => entry.currency.code === draft.currencyCode)?.currency;
      if (!selectedCurrency) throw new Error(translate(locale, "Choose a currency enabled for this market.", "اختر عملة مفعّلة لهذا السوق."));
      const amountMinor = toMinorUnits(draft.amount, selectedCurrency.minorUnit);
      const payload = {
        storeId, marketId: draft.marketId, currencyCode: draft.currencyCode,
        name: draft.name, description: draft.description || undefined,
        amountMinor,
        destinationRegion: draft.destinationRegion || null,
        minDeliveryDays: draft.minDeliveryDays === "" ? null : Number(draft.minDeliveryDays),
        maxDeliveryDays: draft.maxDeliveryDays === "" ? null : Number(draft.maxDeliveryDays),
        priority: Number(draft.priority || 0), isActive: draft.isActive
      };
      await readJson(await fetch(editingId ? `/api/seller/shipping-rates/${encodeURIComponent(editingId)}` : "/api/seller/shipping-rates", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }));
      await loadRates(storeId);
      resetForm();
      toast.success(translate(locale, "Shipping service saved.", "تم حفظ خدمة الشحن."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to save shipping service.", "تعذر حفظ خدمة الشحن.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateRate(rate: Rate) {
    if (!storeId || !rate.isActive || saving) return;
    if (typeof window !== "undefined" && !window.confirm(translate(locale, "Pause this shipping service? It will no longer appear at checkout, while existing orders remain unchanged.", "إيقاف خدمة الشحن؟ لن تظهر عند الدفع بعد الآن، مع بقاء الطلبات السابقة دون تغيير."))) return;
    setSaving(true);
    setError("");
    try {
      await readJson(await fetch(`/api/seller/shipping-rates/${encodeURIComponent(rate.id)}`, { method: "DELETE" }));
      await loadRates(storeId);
      if (editingId === rate.id) resetForm();
      toast.success(translate(locale, "Shipping service paused. Existing orders were preserved.", "تم إيقاف خدمة الشحن مع الحفاظ على الطلبات السابقة."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to pause shipping service.", "تعذر إيقاف خدمة الشحن.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] space-y-6 bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-clay)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--muted)]">{translate(locale, "Store operations", "عمليات المتجر")}</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--color-ink-950)] sm:text-3xl">{translate(locale, "Shipping settings", "إعدادات الشحن")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-600)]">{translate(locale, "Create and maintain delivery services, destination regions, prices and estimated delivery windows for each enabled market.", "أنشئ وعدّل خدمات التوصيل ومناطق الوجهة والأسعار والمدة المتوقعة لكل سوق مفعّل.")}</p>
        {stores.length > 1 && <label className="mt-5 block max-w-sm text-sm font-semibold">{translate(locale, "Store", "المتجر")}<select className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" value={storeId} onChange={(event) => selectStore(event.target.value)}><option value="">{translate(locale, "Choose a store", "اختر متجراً")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}
      </header>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {loading ? <div className="rounded-2xl bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">{translate(locale, "Loading shipping settings…", "جارٍ تحميل إعدادات الشحن…")}</div> : !stores.length ? (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-clay)]"><h2 className="text-lg font-bold">{translate(locale, "No seller store found", "لم يتم العثور على متجر")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Create your store before configuring delivery.", "أنشئ متجرك قبل إعداد التوصيل.")}</p></section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{translate(locale, "Your delivery services", "خدمات التوصيل")}</h2><span className="rounded-full bg-[var(--color-mint-100)] px-3 py-1 text-xs font-bold text-[var(--color-mint-800)]">{rates.length}</span></div>
            {rates.length ? rates.map((rate) => (
              <article key={rate.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-clay)]">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-[var(--color-ink-950)]">{rate.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{rate.market.name} · {rate.market.code} · {rate.currencyCode}</p></div><strong className="text-lg tabular-nums">{formatMinorUnits(rate.amountMinor, rate.currencyCode, rate.currency.minorUnit, locale)}</strong></div>
                {rate.description && <p className="mt-2 text-sm text-[var(--color-ink-600)]">{rate.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]"><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">{rate.destinationRegion || translate(locale, "All destinations", "كل الوجهات")}</span><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">{rate.minDeliveryDays ?? "—"}–{rate.maxDeliveryDays ?? "—"} {translate(locale, "days", "أيام")}</span><StatusBadge locale={locale} status={rate.isActive ? "ACTIVE" : "INACTIVE"} /></div>
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(rate)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold hover:bg-[var(--surface-soft)]">{translate(locale, "Edit service", "تعديل الخدمة")}</button>{rate.isActive && <button type="button" onClick={() => void deactivateRate(rate)} disabled={saving} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-50">{translate(locale, "Pause service", "إيقاف الخدمة")}</button>}</div>
              </article>
            )) : <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No shipping services yet. Add your first service.", "لا توجد خدمات شحن بعد. أضف خدمتك الأولى.")}</div>}
          </section>

          <section className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-clay)] sm:p-6">
            <h2 className="text-lg font-extrabold">{editingId ? translate(locale, "Edit delivery service", "تعديل خدمة التوصيل") : translate(locale, "Add delivery service", "إضافة خدمة توصيل")}</h2>
            <form onSubmit={saveRate} className="mt-5 space-y-4">
              <input type="hidden" name="marketId" value={draft.marketId} />
              <label className="block text-sm font-semibold">{translate(locale, "Currency", "العملة")}<select required value={draft.currencyCode} onChange={(event) => updateDraft("currencyCode", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><option value="">{translate(locale, "Select currency", "اختر العملة")}</option>{(enabledMarkets.find((market) => market.id === draft.marketId)?.currencies ?? []).map(({ currency }) => <option key={currency.code} value={currency.code}>{currency.name} ({currency.code})</option>)}</select><span className="mt-1 block text-xs font-normal text-[var(--muted)]">{translate(locale, "Choose any currency enabled for this market. Syria supports SYP as its base currency and USD as an additional currency.", "اختر أي عملة مفعّلة لهذا السوق. العملة الأساسية لسوريا هي الليرة السورية مع إتاحة الدولار كعملة إضافية.")}</span></label>
              <label className="block text-sm font-semibold">{translate(locale, "Service name", "اسم الخدمة")}<input required minLength={2} maxLength={120} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" placeholder={translate(locale, "Standard delivery", "التوصيل العادي")} /></label>
              <label className="block text-sm font-semibold">{translate(locale, "Description", "الوصف")}<textarea maxLength={500} value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" rows={2} /></label>
              <label className="block text-sm font-semibold">{translate(locale, "Delivery price", "سعر التوصيل")} ({draft.currencyCode || "—"})<input required inputMode="decimal" type="text" value={draft.amount} onChange={(e) => updateDraft("amount", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" placeholder="0.00" /></label>
              <label className="block text-sm font-semibold">{translate(locale, "Destination region (optional)", "منطقة الوجهة (اختياري)")}<input value={draft.destinationRegion} onChange={(e) => updateDraft("destinationRegion", e.target.value)} maxLength={120} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" placeholder={translate(locale, "e.g. North Holland", "مثلاً: شمال هولندا")} /></label>
              <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">{translate(locale, "Minimum days", "أقل مدة بالأيام")}<input type="number" min="0" max="365" value={draft.minDeliveryDays} onChange={(e) => updateDraft("minDeliveryDays", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" /></label><label className="text-sm font-semibold">{translate(locale, "Maximum days", "أقصى مدة بالأيام")}<input type="number" min="0" max="365" value={draft.maxDeliveryDays} onChange={(e) => updateDraft("maxDeliveryDays", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" /></label></div>
              <label className="block text-sm font-semibold">{translate(locale, "Priority (lower appears first)", "الأولوية (الأقل يظهر أولاً)")}<input type="number" min="0" max="10000" value={draft.priority} onChange={(e) => updateDraft("priority", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" /></label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm font-semibold"><input type="checkbox" checked={draft.isActive} onChange={(e) => updateDraft("isActive", e.target.checked)} className="h-4 w-4 accent-[var(--color-lavender-700)]" />{translate(locale, "Offer this service at checkout", "إتاحة خدمة الشحن عند الدفع")}</label>
              <div className="flex flex-wrap gap-2"><button disabled={saving || !storeId || !enabledMarkets.length} type="submit" className="rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-bold text-white hover:bg-[#E8750B] disabled:opacity-50">{saving ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Save shipping service", "حفظ خدمة الشحن")}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-bold">{translate(locale, "Cancel", "إلغاء")}</button>}</div>
              <p className="text-xs leading-5 text-[var(--muted)]">{translate(locale, "Enter the normal customer-facing price. It is converted safely to the selected currency minor units before saving.", "أدخل السعر المعتاد الذي سيظهر للعملاء، وسيُحوّل بدقة إلى الوحدات الصغرى للعملة المختارة قبل الحفظ.")}</p>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
