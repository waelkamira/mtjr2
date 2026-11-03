"use client";

import { useEffect, useState } from "react";

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
  onSaved: (address: DeliveryAddress) => void;
};

const emptyAddress = {
  recipientName: "", phone: "", line1: "", line2: "", city: "",
  region: "", postalCode: ""
};

export default function CheckoutDeliveryAddress({ quoteId, quoteStatus, onSaved }: Props) {
  const [country, setCountry] = useState<{ iso2: string; name: string } | null>(null);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
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
        if (!response.ok || !result.marketCountry) throw new Error(result.error || "Unable to load delivery address options.");
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
          onSaved(result.deliveryAddress);
        } else {
          const defaultAddress = result.savedAddresses?.find((item) => item.isDefault);
          if (defaultAddress) setSelected(defaultAddress.id);
        }
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load delivery address options."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quoteId, onSaved]);

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
      if (!response.ok || !result.address) throw new Error(result.error || "Unable to save delivery address.");
      onSaved(result.address);
      setSuccess("Delivery address saved to this checkout quote.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save delivery address.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-copper-600)]">Delivery details</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-forest-950)]">Where should we deliver?</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Delivery country: {country?.name ?? "Loading…"}</p>
        </div>
        {quoteStatus !== "ACTIVE" && <span className="text-xs font-semibold text-[var(--color-danger)]">Quote inactive</span>}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm text-[var(--color-forest-900)]">{success}</p>}

      {loading ? <div className="mt-5 h-40 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : country ? <>
        {saved.length > 0 && <label className="mt-5 block text-sm font-medium text-[var(--color-forest-950)]">
          Saved addresses
          <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm">
            <option value="new">Enter a new address</option>
            {saved.map((address) => <option key={address.id} value={address.id}>{address.label || address.recipientName} — {address.line1}, {address.city}</option>)}
          </select>
        </label>}

        {selected === "new" && <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[var(--color-forest-950)]">Recipient name<input required maxLength={160} value={draft.recipientName} onChange={(event) => updateDraft("recipientName", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">Phone (international)<input required type="tel" placeholder="+31612345678" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)] sm:col-span-2">Address line 1<input required maxLength={200} value={draft.line1} onChange={(event) => updateDraft("line1", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)] sm:col-span-2">Address line 2 (optional)<input maxLength={200} value={draft.line2} onChange={(event) => updateDraft("line2", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">City<input required maxLength={120} value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">Region / State<input maxLength={120} value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-medium text-[var(--color-forest-950)]">Postal code<input maxLength={32} value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} disabled={quoteStatus !== "ACTIVE"} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 font-normal" /></label>
          <div className="flex items-end text-sm text-[var(--muted)]">Country is fixed by the selected delivery market.</div>
        </div>}

        {canSave && selected === "new" && <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-forest-800)]"><input type="checkbox" checked={saveToBook} onChange={(event) => setSaveToBook(event.target.checked)} disabled={quoteStatus !== "ACTIVE"} />Save to my address book</label>}

        {selected !== "new" && <div className="mt-5 rounded-2xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6 text-[var(--color-forest-900)]">
          {saved.find((item) => item.id === selected)?.recipientName}<br />
          {saved.find((item) => item.id === selected)?.line1}<br />
          {saved.find((item) => item.id === selected)?.city}, {country.name}<br />
          {saved.find((item) => item.id === selected)?.phone}
        </div>}

        <button type="button" onClick={() => void saveAddress()} disabled={busy || quoteStatus !== "ACTIVE" || !country} className="mt-5 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save delivery address"}</button>
      </> : null}
    </section>
  );
}
