"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { formatMinorUnits } from "@/lib/money";

type Store = { id: string; name: string; slug: string; shippingContactName: string | null; shippingPhone: string | null; shippingAddressLine1: string | null; shippingAddressLine2: string | null; shippingCity: string | null; shippingRegion: string | null; shippingPostalCode: string | null; shippingCountryCode: string | null; shippingInstructions: string | null; markets: Array<{ market: { id: string; code: string; name: string; defaultCurrencyCode: string } }> };
type OriginDraft = { contactName: string; phone: string; addressLine1: string; addressLine2: string; city: string; region: string; postalCode: string; countryCode: string; instructions: string };
const emptyOriginDraft: OriginDraft = { contactName: "", phone: "", addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", countryCode: "", instructions: "" };
function originDraftFromStore(store: Store): OriginDraft { return { contactName: store.shippingContactName ?? "", phone: store.shippingPhone ?? "", addressLine1: store.shippingAddressLine1 ?? "", addressLine2: store.shippingAddressLine2 ?? "", city: store.shippingCity ?? "", region: store.shippingRegion ?? "", postalCode: store.shippingPostalCode ?? "", countryCode: store.shippingCountryCode ?? "", instructions: store.shippingInstructions ?? "" }; }
type Market = { id: string; code: string; name: string; defaultCurrency: { code: string }; currencies: Array<{ currency: { code: string; name: string } }> };
type Rate = { id: string; marketId: string; market: { code: string; name: string }; currencyCode: string; currency: { minorUnit: number }; name: string; description: string | null; amountMinor: string; destinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null; isActive: boolean; priority: number };
type Draft = { marketId: string; currencyCode: string; name: string; description: string; amountMinor: string; destinationRegion: string; minDeliveryDays: string; maxDeliveryDays: string; priority: string; isActive: boolean };
const emptyDraft: Draft = { marketId: "", currencyCode: "", name: "", description: "", amountMinor: "", destinationRegion: "", minDeliveryDays: "", maxDeliveryDays: "", priority: "0", isActive: true };

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
  const [originDraft, setOriginDraft] = useState<OriginDraft>(emptyOriginDraft);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrigin, setSavingOrigin] = useState(false);
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
          setOriginDraft(originDraftFromStore(initialStore));
          try { localStorage.setItem("mtjr.activeStoreId", initialStore.id); } catch { /* Store selection still works for this session. */ }
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
      description: rate.description ?? "", amountMinor: rate.amountMinor,
      destinationRegion: rate.destinationRegion ?? "",
      minDeliveryDays: rate.minDeliveryDays?.toString() ?? "",
      maxDeliveryDays: rate.maxDeliveryDays?.toString() ?? "",
      priority: rate.priority.toString(), isActive: rate.isActive
    });
  }

  function resetForm() {
    setEditingId("");
    setDraft({ ...emptyDraft, marketId: enabledMarkets[0]?.id ?? "", currencyCode: enabledMarkets[0]?.defaultCurrency.code ?? "" });
  }

  function selectStore(id: string) {
    setStoreId(id);
    try { localStorage.setItem("mtjr.activeStoreId", id); } catch { /* Store selection still works for this session. */ }
    const store = stores.find((item) => item.id === id);
    setOriginDraft(store ? originDraftFromStore(store) : emptyOriginDraft);
    resetForm();
  }

  async function saveOrigin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const store = stores.find((item) => item.id === storeId);
    if (!store) return;
    setSavingOrigin(true);
    setError("");
    try {
      await readJson(await fetch(`/api/seller/stores/${encodeURIComponent(store.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: store.name, slug: store.slug,
          shippingContactName: originDraft.contactName.trim() || null,
          shippingPhone: originDraft.phone.trim() || null,
          shippingAddressLine1: originDraft.addressLine1.trim() || null,
          shippingAddressLine2: originDraft.addressLine2.trim() || null,
          shippingCity: originDraft.city.trim() || null,
          shippingRegion: originDraft.region.trim() || null,
          shippingPostalCode: originDraft.postalCode.trim() || null,
          shippingCountryCode: originDraft.countryCode.trim().toUpperCase() || null,
          shippingInstructions: originDraft.instructions.trim() || null
        })
      }));
      const saved = { ...originDraft, countryCode: originDraft.countryCode.trim().toUpperCase() };
      setOriginDraft(saved);
      setStores((current) => current.map((item) => item.id === store.id ? {
        ...item, shippingContactName: saved.contactName.trim() || null, shippingPhone: saved.phone.trim() || null,
        shippingAddressLine1: saved.addressLine1.trim() || null, shippingAddressLine2: saved.addressLine2.trim() || null,
        shippingCity: saved.city.trim() || null, shippingRegion: saved.region.trim() || null,
        shippingPostalCode: saved.postalCode.trim() || null, shippingCountryCode: saved.countryCode || null,
        shippingInstructions: saved.instructions.trim() || null
      } : item));
      toast.success(translate(locale, "Dispatch address saved.", "تم حفظ عنوان تجهيز الشحنات."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to save dispatch address.", "تعذر حفظ عنوان تجهيز الشحنات.");
      setError(message); toast.error(message);
    } finally { setSavingOrigin(false); }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        storeId, marketId: draft.marketId, currencyCode: draft.currencyCode,
        name: draft.name, description: draft.description || undefined,
        amountMinor: draft.amountMinor,
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] space-y-6 bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-clay)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--muted)]">{translate(locale, "Store operations", "عمليات المتجر")}</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--color-ink-950)] sm:text-3xl">{translate(locale, "Shipping settings", "إعدادات الشحن")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-600)]">{translate(locale, "Create and maintain delivery services, destination regions, prices and estimated delivery windows for each enabled market.", "أنشئ وعدّل خدمات التوصيل ومناطق الوجهة والأسعار والمدة المتوقعة لكل سوق مفعّل.")}</p>
        {stores.length > 1 && <label className="mt-5 block max-w-sm text-sm font-semibold">{translate(locale, "Store", "المتجر")}<select className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" value={storeId} onChange={(event) => selectStore(event.target.value)><option value="">{translate(locale, "Choose a store", "اختر متجراً")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}
      </header>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!loading && stores.length > 0 && <section className="rounded-[28px] border border-white/90 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-5 shadow-[var(--shadow-clay)] sm:p-7">
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">{translate(locale, "Dispatch origin", "موقع تجهيز الشحنات")}</p><h2 className="mt-1 text-xl font-black text-[var(--color-ink-950)]">{translate(locale, "Pickup & return address", "عنوان الاستلام والمرتجعات")}</h2><p className="mt-1 text-sm text-[var(--color-ink-600)]">{translate(locale, "Save the address and contact details used by carriers to collect outgoing orders and route returns to your store.", "احفظ العنوان وبيانات التواصل التي تستخدمها شركات الشحن لاستلام الطلبات وإعادة المرتجعات إلى متجرك.")}</p></div>
        <form onSubmit={saveOrigin} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">{translate(locale, "Contact person", "الشخص المسؤول")}<input required minLength={2} maxLength={120} value={originDraft.contactName} onChange={(e) => setOriginDraft(v => ({...v,contactName:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm">{translate(locale, "Phone number", "رقم الهاتف")}<input required type="tel" minLength={7} maxLength={25} value={originDraft.phone} onChange={(e) => setOriginDraft(v => ({...v,phone:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm">{translate(locale, "Country code (ISO 2)", "رمز الدولة (حرفان)")}<input required pattern="[A-Za-z]{2}" maxLength={2} value={originDraft.countryCode} onChange={(e) => setOriginDraft(v => ({...v,countryCode:e.target.value.toUpperCase()}))} placeholder="SY" className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5 uppercase" /></label>
          <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Address line 1", "العنوان")}<input required minLength={3} maxLength={240} value={originDraft.addressLine1} onChange={(e) => setOriginDraft(v => ({...v,addressLine1:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm sm:col-span-2">{translate(locale, "Address line 2 (optional)", "تفاصيل إضافية للعنوان (اختياري)")}<input maxLength={240} value={originDraft.addressLine2} onChange={(e) => setOriginDraft(v => ({...v,addressLine2:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm">{translate(locale, "City", "المدينة")}<input required minLength={2} maxLength={120} value={originDraft.city} onChange={(e) => setOriginDraft(v => ({...v,city:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm">{translate(locale, "Region / governorate", "المنطقة / المحافظة")}<input maxLength={120} value={originDraft.region} onChange={(e) => setOriginDraft(v => ({...v,region:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm">{translate(locale, "Postal code", "الرمز البريدي")}<input maxLength={40} value={originDraft.postalCode} onChange={(e) => setOriginDraft(v => ({...v,postalCode:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-3">{translate(locale, "Carrier instructions", "تعليمات لشركة الشحن")}<textarea rows={2} maxLength={1000} value={originDraft.instructions} onChange={(e) => setOriginDraft(v => ({...v,instructions:e.target.value}))} className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5" /></label>
          <div className="sm:col-span-2 lg:col-span-3"><button disabled={savingOrigin || !storeId} className="rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{savingOrigin ? translate(locale, "Saving address…", "جارٍ حفظ العنوان…") : translate(locale, "Save dispatch address", "حفظ عنوان الشحن")}</button></div>
        </form>
      </section>}
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
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]"><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">{rate.destinationRegion || translate(locale, "All destinations", "كل الوجهات")}</span><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">{rate.minDeliveryDays ?? "—"}–{rate.maxDeliveryDays ?? "—"} {translate(locale, "days", "أيام")}</span><span className={`rounded-full px-3 py-1 ${rate.isActive ? "bg-[var(--color-mint-100)] text-[var(--color-mint-800)]" : "bg-[var(--surface-soft)]"}`}>{rate.isActive ? translate(locale, "Active", "نشطة") : translate(locale, "Inactive", "متوقفة")}</span></div>
                <button type="button" onClick={() => startEdit(rate)} className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold hover:bg-[var(--surface-soft)]">{translate(locale, "Edit service", "تعديل الخدمة")}</button>
              </article>
            )) : <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No shipping services yet. Add your first service.", "لا توجد خدمات شحن بعد. أضف خدمتك الأولى.")}</div>}
          </section>

          <section className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-clay)] sm:p-6">
            <h2 className="text-lg font-extrabold">{editingId ? translate(locale, "Edit delivery service", "تعديل خدمة التوصيل") : translate(locale, "Add delivery service", "إضافة خدمة توصيل")}</h2>
            <form onSubmit={saveRate} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">{translate(locale, "Market", "السوق")}<select required value={draft.marketId} onChange={(e) => { const m = enabledMarkets.find((item) => item.id === e.target.value); updateDraft("marketId", e.target.value); updateDraft("currencyCode", m?.defaultCurrency.code ?? ""); }} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><option value="">{translate(locale, "Select market", "اختر السوق")}</option>{enabledMarkets.map((market) => <option key={market.id} value={market.id}>{market.name} ({market.code})</option>)}</select></label>
              <label className="block text-sm font-semibold">{translate(locale, "Service name", "اسم الخدمة")}<input required minLength={2} maxLength={120} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" placeholder={translate(locale, "Standard delivery", "التوصيل العادي")} /></label>
              <label className="block text-sm font-semibold">{translate(locale, "Description", "الوصف")}<textarea maxLength={500} value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" rows={2} /></label>
              <label className="block text-sm font-semibold">{translate(locale, "Price in minor currency units", "السعر بوحدات العملة الصغرى")}<input required inputMode="numeric" pattern="[0-9]+" value={draft.amountMinor} onChange={(e) => updateDraft("amountMinor", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" placeholder="0" /></label>
              <label className="block text-sm font-semibold">{translate(locale, "Destination region (optional)", "منطقة الوجهة (اختياري)")}<input value={draft.destinationRegion} onChange={(e) => updateDraft("destinationRegion", e.target.value)} maxLength={120} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" placeholder={translate(locale, "e.g. North Holland", "مثلاً: شمال هولندا")} /></label>
              <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">{translate(locale, "Minimum days", "أقل مدة بالأيام")}<input type="number" min="0" max="365" value={draft.minDeliveryDays} onChange={(e) => updateDraft("minDeliveryDays", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" /></label><label className="text-sm font-semibold">{translate(locale, "Maximum days", "أقصى مدة بالأيام")}<input type="number" min="0" max="365" value={draft.maxDeliveryDays} onChange={(e) => updateDraft("maxDeliveryDays", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" /></label></div>
              <label className="block text-sm font-semibold">{translate(locale, "Priority (lower appears first)", "الأولوية (الأقل يظهر أولاً)")}<input type="number" min="0" max="10000" value={draft.priority} onChange={(e) => updateDraft("priority", e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" /></label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm font-semibold"><input type="checkbox" checked={draft.isActive} onChange={(e) => updateDraft("isActive", e.target.checked)} className="h-4 w-4 accent-[var(--color-lavender-700)]" />{translate(locale, "Offer this service at checkout", "إتاحة خدمة الشحن عند الدفع")}</label>
              <div className="flex flex-wrap gap-2"><button disabled={saving || !storeId || !enabledMarkets.length} type="submit" className="rounded-xl bg-[var(--color-lavender-700)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Save shipping service", "حفظ خدمة الشحن")}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-bold">{translate(locale, "Cancel", "إلغاء")}</button>}</div>
              <p className="text-xs leading-5 text-[var(--muted)]">{translate(locale, "Prices are entered in the currency's minor units (for example, cents). Only active services matching the buyer's market and delivery region are offered at checkout.", "تُدخل الأسعار بوحدات العملة الصغرى (مثل السنت). تظهر عند الدفع الخدمات النشطة المطابقة لسوق المشتري ومنطقة التوصيل.")}</p>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
