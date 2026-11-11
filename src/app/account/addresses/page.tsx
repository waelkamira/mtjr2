
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Address = {
  id: string; label: string | null; recipientName: string; phone: string;
  line1: string; line2: string | null; city: string; region: string | null;
  postalCode: string | null; isDefault: boolean; countryCode: string; countryName: string;
};
type Country = { iso2: string; name: string };
type AddressDraft = {
  label: string; recipientName: string; phone: string; countryCode: string;
  line1: string; line2: string; city: string; region: string; postalCode: string;
};

const emptyDraft: AddressDraft = {
  label: "", recipientName: "", phone: "", countryCode: "",
  line1: "", line2: "", city: "", region: "", postalCode: ""
};

// --- أيقونات بسيطة وأنيقة لتقليل الاعتماد على مكتبات خارجية ---
const Icons = {
  MapPin: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  Edit: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
  Trash: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
  Check: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  Plus: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  ArrowRight: () => <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>,
  Home: () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
};

export default function AddressesPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [items, setItems] = useState<Address[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
  const [editing, setEditing] = useState<Address | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reloadAddresses = useCallback(async () => {
    const response = await fetch("/api/account/addresses", { cache: "no-store" });
    const data = await response.json() as { addresses?: Address[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load addresses.");
    setItems(data.addresses ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/account/addresses", { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { addresses?: Address[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load addresses.");
        return data.addresses ?? [];
      }),
      fetch("/api/countries").then(async (response) => {
        const data = await response.json() as { items?: Country[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load countries.");
        return data.items ?? [];
      })
    ]).then(([addresses, availableCountries]) => {
      if (!active) return;
      setItems(addresses);
      setCountries(availableCountries);
      setDraft((current) => ({ ...current, countryCode: current.countryCode || availableCountries[0]?.iso2 || "" }));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : t("Unable to load addresses.", "تعذّر تحميل العناوين."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  function resetForm() {
    setEditing(null);
    setDraft({ ...emptyDraft, countryCode: countries[0]?.iso2 || "" });
    setMakeDefault(false);
    setError("");
    setNotice("");
  }

  function beginEdit(address: Address) {
    setEditing(address);
    setDraft({
      label: address.label ?? "", recipientName: address.recipientName, phone: address.phone,
      countryCode: address.countryCode, line1: address.line1, line2: address.line2 ?? "",
      city: address.city, region: address.region ?? "", postalCode: address.postalCode ?? ""
    });
    setMakeDefault(false);
    setError("");
    setNotice("");
    // Scroll to form on mobile
    if (window.innerWidth < 1024) {
      document.getElementById("address-form")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(editing ? `/api/account/addresses/${encodeURIComponent(editing.id)}` : "/api/account/addresses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          isDefault: editing ? editing.isDefault : (makeDefault || items.length === 0)
        })
      });
      const data = await response.json() as { address?: Address; error?: string };
      if (!response.ok) throw new Error(data.error || t("Unable to save address.", "تعذّر حفظ العنوان."));
      await reloadAddresses();
      resetForm();
      setNotice(editing ? t("Address updated successfully.", "تم تحديث العنوان بنجاح.") : t("Address saved successfully.", "تم حفظ العنوان بنجاح."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to save address.", "تعذّر حفظ العنوان."));
    } finally {
      setBusy(false);
    }
  }

  async function chooseDefault(address: Address) {
    setActiveAction(address.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/account/addresses/${encodeURIComponent(address.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: address.label, recipientName: address.recipientName, phone: address.phone,
          countryCode: address.countryCode, line1: address.line1, line2: address.line2,
          city: address.city, region: address.region, postalCode: address.postalCode, isDefault: true
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Unable to change the default address.", "تعذر تغيير العنوان الافتراضي."));
      await reloadAddresses();
      setNotice(t("Default address updated.", "تم تحديث العنوان الافتراضي."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to change the default address.", "تعذر تغيير العنوان الافتراضي."));
    } finally {
      setActiveAction("");
    }
  }

  async function removeAddress(address: Address) {
    if (!window.confirm(t("Are you sure you want to delete this saved address?", "هل أنت متأكد من رغبتك في حذف هذا العنوان المحفوظ؟"))) return;
    setActiveAction(address.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/account/addresses/${encodeURIComponent(address.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Unable to delete address.", "تعذر حذف العنوان."));
      await reloadAddresses();
      if (editing?.id === address.id) resetForm();
      setNotice(t("Address deleted successfully.", "تم حذف العنوان بنجاح."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to delete address.", "تعذر حذف العنوان."));
    } finally {
      setActiveAction("");
    }
  }

  // فئة موحدة لحقول الإدخال بتصميم ناعم ومريح
  const inputClass = "mt-1.5 w-full rounded-xl border border-gray-200 p-3 text-sm placeholder-gray-400 transition-all duration-200 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10";

  return (
    <main className="min-h-screen  px-4 py-8 sm:px-6 lg:px-8 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/account" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
            <Icons.ArrowRight />
            {t("My account", "حسابي")}
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t("Saved addresses", "العناوين المحفوظة")}
          </h1>
          <p className="mt-2 text-base text-gray-500">
            {t("Manage your delivery addresses for a faster and smoother checkout experience.", "أدر عناوين التوصيل الخاصة بك لتجربة شراء أسرع وأكثر سلاسة.")}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <span className="mt-0.5 shrink-0"><Icons.Trash /></span>
            <p>{error}</p>
          </div>
        )}
        {notice && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            <span className="mt-0.5 shrink-0"><Icons.Check /></span>
            <p>{notice}</p>
          </div>
        )}

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left Column: Address List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t("Your addresses", "عناوينك")}</h2>
            
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl border border-gray-100 bg-white" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
                <div className="mb-4 grid size-16 place-items-center rounded-full bg-gray-50 text-gray-400">
                  <Icons.MapPin />
                </div>
                <h3 className="text-base font-semibold text-gray-900">{t("No saved addresses yet", "لا توجد عناوين محفوظة بعد")}</h3>
                <p className="mt-1 text-sm text-gray-500">{t("Add your first address using the form on the side.", "أضف عنوانك الأول باستخدام النموذج الموجود على الجانب.")}</p>
              </div>
            ) : (
              items.map((address) => (
                <article 
                  key={address.id} 
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-300 hover:shadow-md ${
                    address.isDefault ? "border-blue-200 shadow-sm ring-1 ring-blue-100" : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  {address.isDefault && (
                    <div className="absolute top-0 right-0 rounded-bl-xl bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {t("Default", "الافتراضي")}
                    </div>
                  )}
                  
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-gray-100 text-gray-600">
                      <Icons.Home />
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{address.label || address.recipientName}</h3>
                      <p className="text-xs text-gray-500">{address.countryName}</p>
                    </div>
                  </div>

                  <p className="mb-5 text-sm leading-relaxed text-gray-600">
                    {address.recipientName}<br />
                    <span className="text-gray-500">{address.phone}</span><br />
                    {address.line1}
                    {address.line2 && <><br />{address.line2}</>}<br />
                    <span className="font-medium text-gray-700">
                      {[address.city, address.region, address.postalCode].filter(Boolean).join(", ")}
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                    <button 
                      type="button" 
                      onClick={() => beginEdit(address)} 
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Icons.Edit /> {t("Edit", "تعديل")}
                    </button>
                    
                    {!address.isDefault && (
                      <button 
                        type="button" 
                        disabled={activeAction === address.id} 
                        onClick={() => void chooseDefault(address)} 
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-50"
                      >
                        <Icons.Check /> {t("Make default", "تعيين كافتراضي")}
                      </button>
                    )}
                    
                    <button 
                      type="button" 
                      disabled={activeAction === address.id} 
                      onClick={() => void removeAddress(address)} 
                      className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Icons.Trash /> {t("Delete", "حذف")}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Right Column: Address Form */}
          <div id="address-form" className="lg:sticky lg:top-8 lg:self-start">
            <form onSubmit={save} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    {editing ? <Icons.Edit /> : <Icons.Plus />}
                  </span>
                  {editing ? t("Edit address", "تعديل العنوان") : t("Add new address", "إضافة عنوان جديد")}
                </h2>
                {editing && (
                  <button 
                    type="button" 
                    onClick={resetForm} 
                    className="text-sm font-medium text-gray-500 transition-colors hover:text-red-600"
                  >
                    {t("Cancel", "إلغاء")}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("Address label (optional)", "اسم العنوان (اختياري)")}</label>
                  <input 
                    className={inputClass} 
                    value={draft.label} 
                    onChange={(event) => setDraft({ ...draft, label: event.target.value })} 
                    maxLength={80} 
                    placeholder={t("e.g., Home, Work", "مثال: المنزل، العمل")} 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("Country", "الدولة")} <span className="text-red-500">*</span></label>
                  <select 
                    className={inputClass + " cursor-pointer"} 
                    value={draft.countryCode} 
                    onChange={(event) => setDraft({ ...draft, countryCode: event.target.value })} 
                    required
                  >
                    {countries.map((country) => (
                      <option key={country.iso2} value={country.iso2}>{country.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("Recipient name", "اسم المستلم")} <span className="text-red-500">*</span></label>
                    <input className={inputClass} value={draft.recipientName} onChange={(event) => setDraft({ ...draft, recipientName: event.target.value })} required minLength={2} maxLength={160} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("Phone number", "رقم الهاتف")} <span className="text-red-500">*</span></label>
                    <input className={inputClass} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required maxLength={32} placeholder="+966 5X XXX XXXX" dir="ltr" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("Street address", "عنوان الشارع")} <span className="text-red-500">*</span></label>
                  <input className={inputClass} value={draft.line1} onChange={(event) => setDraft({ ...draft, line1: event.target.value })} required minLength={3} maxLength={200} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("Apartment, suite, etc. (optional)", "الشقة، الطابق، أو معلومة إضافية (اختياري)")}</label>
                  <input className={inputClass} value={draft.line2} onChange={(event) => setDraft({ ...draft, line2: event.target.value })} maxLength={200} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("City", "المدينة")} <span className="text-red-500">*</span></label>
                    <input className={inputClass} value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required minLength={2} maxLength={120} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("Region / State", "المحافظة / الولاية")}</label>
                    <input className={inputClass} value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} maxLength={120} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("Postal code", "الرمز البريدي")}</label>
                  <input className={inputClass} value={draft.postalCode} onChange={(event) => setDraft({ ...draft, postalCode: event.target.value })} maxLength={32} dir="ltr" />
                </div>

                {!editing && (
                  <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50">
                    <input 
                      type="checkbox" 
                      className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20" 
                      checked={makeDefault} 
                      onChange={(event) => setMakeDefault(event.target.checked)} 
                    />
                    <span className="text-sm font-medium text-gray-700">{t("Make this my default address", "اجعل هذا عنواني الافتراضي")}</span>
                  </label>
                )}
              </div>

              <button 
                disabled={busy || !draft.countryCode} 
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 p-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {t("Saving…", "جارٍ الحفظ…")}
                  </>
                ) : (
                  <>
                    <Icons.Check />
                    {editing ? t("Save changes", "حفظ التعديلات") : t("Save address", "حفظ العنوان")}
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}