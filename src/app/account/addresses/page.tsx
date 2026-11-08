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
    if (!response.ok) throw new Error(data.error || t("Unable to load addresses.", "تعذّر تحميل العناوين."));
    setItems(data.addresses ?? []);
  }, [locale]);

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
      setNotice(editing ? t("Address updated.", "تم تحديث العنوان.") : t("Address saved.", "تم حفظ العنوان."));
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
    if (!window.confirm(t("Delete this saved address?", "هل تريد حذف هذا العنوان المحفوظ؟"))) return;
    setActiveAction(address.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/account/addresses/${encodeURIComponent(address.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Unable to delete address.", "تعذر حذف العنوان."));
      await reloadAddresses();
      if (editing?.id === address.id) resetForm();
      setNotice(t("Address deleted.", "تم حذف العنوان."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to delete address.", "تعذر حذف العنوان."));
    } finally {
      setActiveAction("");
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm";

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/account" className="text-sm text-[var(--color-ink-600)]">← {t("My account", "حسابي")}</Link>
        <h1 className="mt-5 text-3xl font-semibold">{t("Saved addresses", "العناوين المحفوظة")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("Manage delivery addresses used during checkout.", "أدر عناوين التوصيل المستخدمة عند إتمام الشراء.")}</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-3">
            {loading ? <p>{t("Loading…", "جارٍ التحميل…")}</p> : items.map((address) => (
              <article key={address.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <b>{address.label || address.recipientName}</b>
                  {address.isDefault && <span className="rounded-full bg-[var(--color-sage-100)] px-3 py-1 text-xs font-semibold">{t("Default address", "العنوان الافتراضي")}</span>}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {address.recipientName}<br />{address.phone}<br />{address.line1}
                  {address.line2 && <><br />{address.line2}</>}<br />
                  {[address.city, address.region, address.postalCode, address.countryName].filter(Boolean).join(", ")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <button type="button" onClick={() => beginEdit(address)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{t("Edit", "تعديل")}</button>
                  {!address.isDefault && <button type="button" disabled={activeAction === address.id} onClick={() => void chooseDefault(address)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">{t("Make default", "تعيين كافتراضي")}</button>}
                  <button type="button" disabled={activeAction === address.id} onClick={() => void removeAddress(address)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">{t("Delete", "حذف")}</button>
                </div>
              </article>
            ))}
            {!loading && !items.length && <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">{t("No saved addresses yet.", "لا توجد عناوين محفوظة بعد.")}</p>}
          </div>

          <form onSubmit={save} className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{editing ? t("Edit address", "تعديل العنوان") : t("Add an address", "إضافة عنوان")}</h2>
              {editing && <button type="button" onClick={resetForm} className="text-xs font-semibold text-[var(--color-ink-600)]">{t("Cancel", "إلغاء")}</button>}
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block text-sm">{t("Address label (optional)", "اسم العنوان (اختياري)")}<input className={inputClass} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} maxLength={80} placeholder={t("Home, work…", "المنزل، العمل…")} /></label>
              <label className="block text-sm">{t("Country", "الدولة")}<select className={inputClass} value={draft.countryCode} onChange={(event) => setDraft({ ...draft, countryCode: event.target.value })} required>{countries.map((country) => <option key={country.iso2} value={country.iso2}>{country.name}</option>)}</select></label>
              <label className="block text-sm">{t("Recipient name", "اسم المستلم")}<input className={inputClass} value={draft.recipientName} onChange={(event) => setDraft({ ...draft, recipientName: event.target.value })} required minLength={2} maxLength={160} /></label>
              <label className="block text-sm">{t("Phone number (international)", "رقم الهاتف (دولي)")}<input className={inputClass} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required maxLength={32} placeholder="+33612345678" /></label>
              <label className="block text-sm">{t("Street address", "عنوان الشارع")}<input className={inputClass} value={draft.line1} onChange={(event) => setDraft({ ...draft, line1: event.target.value })} required minLength={3} maxLength={200} /></label>
              <label className="block text-sm">{t("Apartment, suite, etc. (optional)", "الشقة أو الطابق (اختياري)")}<input className={inputClass} value={draft.line2} onChange={(event) => setDraft({ ...draft, line2: event.target.value })} maxLength={200} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">{t("City", "المدينة")}<input className={inputClass} value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required minLength={2} maxLength={120} /></label>
                <label className="block text-sm">{t("Region / State", "المحافظة / الولاية")}<input className={inputClass} value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} maxLength={120} /></label>
              </div>
              <label className="block text-sm">{t("Postal code", "الرمز البريدي")}<input className={inputClass} value={draft.postalCode} onChange={(event) => setDraft({ ...draft, postalCode: event.target.value })} maxLength={32} /></label>
              {!editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />{t("Make this my default address", "اجعل هذا عنواني الافتراضي")}</label>}
            </div>
            <button disabled={busy || !draft.countryCode} className="mt-5 w-full rounded-xl bg-[var(--color-ink-800)] p-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? t("Saving…", "جارٍ الحفظ…") : editing ? t("Save changes", "حفظ التعديلات") : t("Save address", "حفظ العنوان")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
