"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Address = {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  isDefault: boolean;
  countryCode: string;
  countryName: string;
};
type Country = { iso2: string; name: string };

export default function AddressesPage() {
  const [items, setItems] = useState<Address[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/account/addresses", { cache: "no-store" }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data.addresses as Address[];
      }),
      fetch("/api/countries", { cache: "no-store" }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data.items as Country[];
      })
    ]).then(([addresses, activeCountries]) => {
      if (!active) return;
      setItems(addresses);
      setCountries(activeCountries);
      setCountryCode(activeCountries[0]?.iso2 ?? "");
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load addresses.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode,
          recipientName,
          phone,
          line1,
          city,
          isDefault: items.length === 0
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(current => [data.address as Address, ...current]);
      setRecipientName("");
      setPhone("");
      setLine1("");
      setCity("");
      setNotice("Address saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save address.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/account" className="text-sm text-[var(--color-forest-800)]">← My account</Link>
        <h1 className="mt-5 text-3xl font-semibold">Saved addresses</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Manage delivery addresses used during checkout.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
        <section className="mt-7 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            {loading ? <p>Loading…</p> : items.map(address => (
              <article key={address.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex justify-between gap-3">
                  <b>{address.label || address.recipientName}</b>
                  {address.isDefault && <span className="text-xs text-[var(--color-copper-600)]">Default</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {address.recipientName}<br />
                  {address.line1}<br />
                  {address.line2 && <>{address.line2}<br /></>}
                  {address.city}{address.region ? ", " + address.region : ""}, {address.countryName}<br />
                  {address.postalCode && <>{address.postalCode}<br /></>}
                  {address.phone}
                </p>
              </article>
            ))}
            {!loading && !items.length && (
              <p className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">No saved addresses yet.</p>
            )}
          </div>
          <form onSubmit={save} className="h-fit rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="font-semibold">Add an address</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Country
                <select className="mt-1 w-full rounded-xl border p-3" value={countryCode} onChange={event => setCountryCode(event.target.value)} required>
                  {countries.map(country => <option key={country.iso2} value={country.iso2}>{country.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                Recipient name
                <input className="mt-1 w-full rounded-xl border p-3" value={recipientName} onChange={event => setRecipientName(event.target.value)} required minLength={2} maxLength={160} />
              </label>
              <label className="block text-sm">
                Phone number
                <input className="mt-1 w-full rounded-xl border p-3" type="tel" placeholder="+33612345678" pattern="\+[1-9][0-9]{7,14}" value={phone} onChange={event => setPhone(event.target.value)} required maxLength={32} />
                <span className="mt-1 block text-xs text-[var(--muted)]">Use international format, including the + country code.</span>
              </label>
              <label className="block text-sm">
                Street address
                <input className="mt-1 w-full rounded-xl border p-3" value={line1} onChange={event => setLine1(event.target.value)} required minLength={3} maxLength={200} />
              </label>
              <label className="block text-sm">
                City
                <input className="mt-1 w-full rounded-xl border p-3" value={city} onChange={event => setCity(event.target.value)} required minLength={2} maxLength={120} />
              </label>
            </div>
            <button disabled={busy || !countryCode} className="mt-5 w-full rounded-xl bg-[var(--color-forest-900)] p-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save address"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
