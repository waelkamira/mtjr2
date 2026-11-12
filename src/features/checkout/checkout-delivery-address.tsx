"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type DeliveryAddress = {
  id?: string;
  sourceAddressId?: string | null;
  recipientName: string;
  phone: string;
  countryCode: string;
  countryName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
};

type SavedAddress = DeliveryAddress & { id: string; label: string | null; isDefault: boolean };

type Props = {
  quoteId: string;
  quoteStatus: string;
};

const emptyAddress = {
  recipientName: "", phone: "", line1: "", line2: "", city: "",
  region: "", postalCode: ""
};

export default function CheckoutDeliveryAddress({ quoteId, quoteStatus }: Props) {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [country, setCountry] = useState<{ iso2: string; name: string } | null>(null);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [currentAddress, setCurrentAddress] = useState<DeliveryAddress | null>(null);
  const [selected, setSelected] = useState("new");
  const [draft, setDraft] = useState(emptyAddress);
  const [canSave, setCanSave] = useState(false);
  const [saveToBook, setSaveToBook] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}/address`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as {
          marketCountry?: { iso2: string; name: string };
          savedAddresses?: SavedAddress[];
          deliveryAddress?: DeliveryAddress | null;
          isAuthenticated?: boolean;
          error?: string;
        };
        if (!response.ok || !result.marketCountry) throw new Error(result.error || t("Unable to load delivery address options.", "تعذّر تحميل خيارات عنوان التوصيل."));
        if (!active) return;
        setCountry(result.marketCountry);
        setSaved(result.savedAddresses ?? []);
        setCanSave(Boolean(result.isAuthenticated));
        if (result.deliveryAddress) {
          setDraft({
            recipientName: result.deliveryAddress.recipientName,
            phone: result.deliveryAddress.phone,
            line1: result.deliveryAddress.line1,
            line2: result.deliveryAddress.line2 ?? "",
            city: result.deliveryAddress.city,
            region: result.deliveryAddress.region ?? "",
            postalCode: result.deliveryAddress.postalCode ?? ""
          });
          const sourceId = result.deliveryAddress.sourceAddressId;
          setSelected(sourceId && result.savedAddresses?.some((item) => item.id === sourceId) ? sourceId : "new");
          setCurrentAddress(result.deliveryAddress);
        } else {
          const defaultAddress = result.savedAddresses?.find((item) => item.isDefault);
          if (defaultAddress) setSelected(defaultAddress.id);
        }
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("Unable to load delivery address options.", "تعذّر تحميل خيارات عنوان التوصيل.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quoteId, t]);

  function updateDraft(field: keyof typeof emptyAddress, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveAddress() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const body = selected !== "new"
        ? { addressId: selected }
        : { ...draft, saveToAddressBook: canSave && saveToBook };
      const response = await fetch(`/api/checkout/quote/${encodeURIComponent(quoteId)}/address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json() as { address?: DeliveryAddress; error?: string };
      if (!response.ok || !result.address) throw new Error(result.error || t("Unable to save delivery address.", "تعذّر حفظ عنوان التوصيل."));
      setCurrentAddress(result.address);
      setSuccess(t("Delivery address saved to this checkout quote.", "تم حفظ عنوان التوصيل لطلب الشراء هذا."));
      toast.success(t("Delivery address saved.", "تم حفظ عنوان التوصيل."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Unable to save delivery address.", "تعذّر حفظ عنوان التوصيل."); setError(message); toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-copper-600)]">{t("Delivery details", "تفاصيل التوصيل")}</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-forest-950)]">{t("Where should we deliver?", "إلى أين نوصّل طلبك؟")}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("Delivery country:", "بلد التوصيل:")} {country?.name ?? t("Loading…", "جارٍ التحميل…")}</p>
        </div>
        {quoteStatus !== "ACTIVE" && <span className="text-xs font-semibold text-[var(--color-danger)]">{t("Quote inactive", "عرض السعر غير نشط")}</span>}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm text-[var(--color-forest-900)]">{success}</p>}

      {loading ? <div className="mt-5 h-40 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : country ? <>
        {saved.length > 0 && <label className="mt-5 block text-sm font-medium text-[var(--color-forest-950)]">
          {t("Saved addresses", "العناوين المحفوظة")}
          <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm">
            <option value="new">{t("Enter a new address", "أدخل عنوانًا جديدًا")}</option>
            {saved.map((address) => <option key={address.id} value={address.id}>{address.label || address.recipientName} — {address.line1}, {address.city}</option>)}
          </select>
        </label>}

        {selected === "new" && <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[var(--color-forest-950)]">{t("Recipient name", "اسم المستلم")}<input required maxLength={160} value={draft.recipientName} onChange={(event) => updateDraft("recipientName", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">{t("Phone (international)", "رقم الهاتف (دولي)")}<input required type="tel" placeholder="+31612345678" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)] sm:col-span-2">{t("Address line 1", "العنوان، السطر الأول")}<input required maxLength={200} value={draft.line1} onChange={(event) => updateDraft("line1", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)] sm:col-span-2">{t("Address line 2 (optional)", "العنوان، السطر الثاني (اختياري)")}<input maxLength={200} value={draft.line2} onChange={(event) => updateDraft("line2", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">{t("City", "المدينة")}<input required maxLength={120} value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">{t("Region / State", "المنطقة / الولاية")}<input maxLength={120} value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">{t("Postal code", "الرمز البريدي")}<input maxLength={32} value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <div className="flex items-end text-sm text-[var(--muted)]">{t("Country is fixed to Syria for the current launch.", "البلد ثابت على سوريا في مرحلة الإطلاق الحالية.")}</div>
        </div>}

        {canSave && selected === "new" && <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-forest-800)]"><input type="checkbox" checked={saveToBook} onChange={(event) => setSaveToBook(event.target.checked)} disabled={quoteStatus !== "ACTIVE"} />{t("Save to my address book", "احفظه في دفتر عناويني")}</label>}

        {currentAddress && <div className="mt-5 rounded-2xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6 text-[var(--color-forest-900)]"><p className="mb-2 text-xs font-semibold uppercase tracking-wide">{t("Saved to this quote", "تم الحفظ لعرض السعر هذا")}</p>{currentAddress.recipientName}<br />{currentAddress.line1}<br />{currentAddress.city}, {currentAddress.countryName}<br />{currentAddress.phone}</div>}

        {selected !== "new" && <div className="mt-5 rounded-2xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6 text-[var(--color-forest-900)]">
          {saved.find((item) => item.id === selected)?.recipientName}<br />
          {saved.find((item) => item.id === selected)?.line1}<br />
          {saved.find((item) => item.id === selected)?.city}, {country.name}<br />
          {saved.find((item) => item.id === selected)?.phone}
        </div>}

        <button type="button" onClick={() => void saveAddress()} disabled={busy || quoteStatus !== "ACTIVE" || !country} className="mt-5 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save delivery address", "احفظ عنوان التوصيل")}</button>
      </> : null}
    </section>
  );
}
