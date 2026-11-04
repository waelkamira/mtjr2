"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Market = { id: string; code: string; name: string; defaultCurrency: { code: string } };
type Store = {
  id: string; name: string; slug: string; status: string; isOwner: boolean;
  markets: Array<{ market: { id: string; code: string; name: string; defaultCurrencyCode: string } }>;
  warehouses: Array<{ id: string; code: string; name: string; _count: { inventories: number } }>;
};
type Workspace = {
  seller: null | { id: string; status: string; legalName: string | null; displayName: string | null };
  stores: Store[];
};
type ShippingRate = { id: string; market: { code: string; name: string }; currencyCode: string; name: string; amountMinor: string; destinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null; isActive: boolean };
type InventoryRow = {
  id: string; quantityOnHand: number; quantityReserved: number; quantityAvailable: number;
  reorderPoint: number; isLowStock: boolean;
  warehouse: { id: string; code: string; name: string };
  variant: { id: string; sku: string | null; name: string | null; product: { name: string; slug: string } };
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
  return body as T;
}

export default function SellerWorkspacePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [shippingMarketId, setShippingMarketId] = useState("");
  const [shippingName, setShippingName] = useState("");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [shippingRegion, setShippingRegion] = useState("");
  const [shippingMinDays, setShippingMinDays] = useState("");
  const [shippingMaxDays, setShippingMaxDays] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const data = await readJson<Workspace>(await fetch("/api/seller/stores", { cache: "no-store" }));
    setWorkspace(data);
    if (!selectedStoreId && data.stores[0]) setSelectedStoreId(data.stores[0].id);
  }, [selectedStoreId]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/markets").then((r) => readJson<{ items: Market[] }>(r)),
      fetch("/api/seller/stores", { cache: "no-store" }).then((r) => readJson<Workspace>(r))
    ]).then(([marketResult, sellerResult]) => {
      if (!active) return;
      setMarkets(marketResult.items);
      setWorkspace(sellerResult);
      if (sellerResult.stores[0]) setSelectedStoreId(sellerResult.stores[0].id);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Sign in to access the seller workspace.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;
    let active = true;
    fetch(`/api/seller/shipping-rates?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
      .then((r) => readJson<{ rates: ShippingRate[] }>(r))
      .then((data) => { if (active) setShippingRates(data.rates); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Shipping rates could not be loaded."); });
    fetch(`/api/seller/inventory?storeId=${encodeURIComponent(selectedStoreId)}`, { cache: "no-store" })
      .then((r) => readJson<InventoryRow[]>(r))
      .then((rows) => { if (active) setInventory(rows); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Inventory could not be loaded."); });
    return () => { active = false; };
  }, [selectedStoreId]);

  async function submit(event: FormEvent<HTMLFormElement>, path: string, payload: unknown, success: string) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await readJson(await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }));
      setMessage(success);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally { setBusy(false); }
  }

  const selectedStore = workspace?.stores.find((store) => store.id === selectedStoreId);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--color-ivory-50)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <span className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Seller workspace</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Your business</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Seller workspace</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Manage your seller application, stores, active markets and warehouse stock. Every action is checked by the marketplace backend.</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-950)]">{message}</p>}
        {loading ? <p className="py-16 text-sm text-[var(--muted)]">Loading your workspace…</p> : !workspace?.seller ? (
          <section className="mt-8 max-w-2xl rounded-3xl border border-[var(--border)] bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Apply to become a seller</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Submit your legal and public business names. Your application will remain pending until reviewed by the marketplace team.</p>
            <form onSubmit={(event) => submit(event, "/api/seller/applications", { legalName, displayName }, "Your seller application has been submitted.")} className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">Legal business name<input required minLength={2} maxLength={160} value={legalName} onChange={(e) => setLegalName(e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 font-normal" /></label>
              <label className="grid gap-2 text-sm font-medium">Storefront display name<input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl border border-[var(--border)] px-4 py-3 font-normal" /></label>
              <button disabled={busy} className="mt-2 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit application"}</button>
            </form>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Seller status</h2><span className="rounded-full bg-[var(--color-sage-100)] px-3 py-1 text-xs font-semibold text-[var(--color-forest-900)]">{workspace.seller.status}</span></div>
              <p className="mt-3 text-sm text-[var(--muted)]">{workspace.seller.displayName ?? workspace.seller.legalName}</p>
              {workspace.seller.status === "PENDING" && <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6">Your application is awaiting review. Store creation becomes available after approval.</p>}
              {workspace.seller.status === "ACTIVE" && (
                <form onSubmit={(event) => submit(event, "/api/seller/stores", { name: storeName, slug: storeSlug, marketIds: selectedMarketIds }, "Your draft store has been created.")} className="mt-6 grid gap-4 border-t border-[var(--border)] pt-6">
                  <h3 className="font-semibold">Create a store</h3>
                  <label className="grid gap-2 text-sm">Store name<input required minLength={2} maxLength={120} value={storeName} onChange={(e) => { setStoreName(e.target.value); setStoreSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} className="rounded-xl border border-[var(--border)] px-3 py-2.5" /></label>
                  <label className="grid gap-2 text-sm">Store URL slug<input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="rounded-xl border border-[var(--border)] px-3 py-2.5" /></label>
                  <fieldset className="grid gap-2"><legend className="text-sm font-medium">Markets served</legend>{markets.map((market) => <label key={market.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedMarketIds.includes(market.id)} onChange={(e) => setSelectedMarketIds((ids) => e.target.checked ? [...ids, market.id] : ids.filter((id) => id !== market.id))} />{market.name} · {market.defaultCurrency.code}</label>)}{!markets.length && <p className="text-xs text-[var(--muted)]">No active launch markets are configured yet.</p>}</fieldset>
                  <button disabled={busy || !selectedMarketIds.length} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating…" : "Create draft store"}</button>
                </form>
              )}
            </section>
            <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
              <h2 className="text-lg font-semibold">Your stores</h2>
              {!workspace.stores.length ? <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-5 text-sm text-[var(--muted)]">No stores have been created yet.</p> : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">{workspace.stores.map((store) => <button key={store.id} onClick={() => setSelectedStoreId(store.id)} className={`rounded-xl border px-4 py-2 text-sm ${selectedStoreId === store.id ? "border-[var(--color-forest-800)] bg-[var(--color-forest-900)] text-white" : "border-[var(--border)]"}`}>{store.name}</button>)}</div>
                  {selectedStore && <div className="mt-6 border-t border-[var(--border)] pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><div><h3 className="font-semibold">{selectedStore.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">/{selectedStore.slug} · {selectedStore.status}</p></div><div className="mt-2 flex flex-wrap gap-2"><Link href="/seller/products" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">Manage products</Link><Link href="/seller/inventory" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">Inventory operations</Link><Link href="/seller/staff" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-forest-900)]">Team & access</Link></div></div><span className="text-xs text-[var(--muted)]">{selectedStore.markets.length} active markets</span></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {selectedStore.warehouses.map((warehouse) => <div key={warehouse.id} className="rounded-xl bg-[var(--color-ivory-100)] p-4"><p className="font-medium">{warehouse.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{warehouse.code} · {warehouse._count.inventories} inventory records</p></div>)}
                    </div>
                    {selectedStore.isOwner && <form onSubmit={(event) => submit(event, "/api/seller/warehouses", { storeId: selectedStore.id, name: warehouseName, code: warehouseCode }, "Warehouse created.")} className="mt-5 grid gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1 text-xs">Warehouse name<input required minLength={2} maxLength={120} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                      <label className="grid gap-1 text-xs">Code<input required minLength={2} maxLength={40} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value.toUpperCase())} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                      <button disabled={busy} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Add warehouse</button>
                    </form>}
                    <div className="mt-7 border-t border-[var(--border)] pt-6">
                      <h3 className="font-semibold">Shipping services</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Rates are scoped to a market and optional destination region. Enter the amount in the selected currency&apos;s minor units.</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {shippingRates.map((rate) => <div key={rate.id} className="rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm"><p className="font-semibold">{rate.name} · {rate.market.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{rate.amountMinor} {rate.currencyCode} minor units{rate.destinationRegion ? ` · ${rate.destinationRegion}` : " · All regions"}</p><p className="mt-1 text-xs text-[var(--muted)]">{rate.minDeliveryDays ?? "—"}–{rate.maxDeliveryDays ?? "—"} days · {rate.isActive ? "Active" : "Inactive"}</p></div>)}
                        {!shippingRates.length && <p className="rounded-xl bg-[var(--color-ivory-100)] p-4 text-xs text-[var(--muted)]">No shipping services configured.</p>}
                      </div>
                      {selectedStore.isOwner && <form onSubmit={async (event) => {
                        event.preventDefault();
                        const market = selectedStore.markets.find((item) => item.market.id === shippingMarketId);
                        if (!market) return;
                        await submit(event, "/api/seller/shipping-rates", {
                          storeId: selectedStore.id, marketId: market.market.id, currencyCode: market.market.defaultCurrencyCode,
                          name: shippingName, amountMinor: shippingAmount,
                          destinationRegion: shippingRegion || null,
                          minDeliveryDays: shippingMinDays ? Number(shippingMinDays) : null,
                          maxDeliveryDays: shippingMaxDays ? Number(shippingMaxDays) : null
                        }, "Shipping service created.");
                      }} className="mt-4 grid gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs">Market<select required value={shippingMarketId} onChange={(e) => setShippingMarketId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"><option value="">Choose market</option>{selectedStore.markets.map(({ market }) => <option key={market.id} value={market.id}>{market.name} · {market.defaultCurrencyCode}</option>)}</select></label>
                        <label className="grid gap-1 text-xs">Service name<input required minLength={2} maxLength={120} value={shippingName} onChange={(e) => setShippingName(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">Amount (minor units)<input required type="number" min="0" step="1" value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">Destination region<input maxLength={120} value={shippingRegion} onChange={(e) => setShippingRegion(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">Minimum days<input type="number" min="0" max="365" value={shippingMinDays} onChange={(e) => setShippingMinDays(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <label className="grid gap-1 text-xs">Maximum days<input type="number" min="0" max="365" value={shippingMaxDays} onChange={(e) => setShippingMaxDays(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" /></label>
                        <button disabled={busy || !selectedStore.markets.length} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2">Add shipping service</button>
                      </form>}
                    </div>
                    <div className="mt-7">
                      <h3 className="font-semibold">Inventory overview</h3>
                      {!inventory.length ? <p className="mt-3 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm text-[var(--muted)]">No stock records in this store yet.</p> : (
                        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3 pr-3">Product / SKU</th><th className="py-3 pr-3">Warehouse</th><th className="py-3 pr-3">On hand</th><th className="py-3 pr-3">Reserved</th><th className="py-3">Available</th></tr></thead><tbody>{inventory.map((row) => <tr key={row.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-3"><p className="font-medium">{row.variant.product.name}</p><p className="text-xs text-[var(--muted)]">{row.variant.sku ?? row.variant.name ?? "Variant"}</p></td><td className="py-3 pr-3">{row.warehouse.name}</td><td className="py-3 pr-3">{row.quantityOnHand}</td><td className="py-3 pr-3">{row.quantityReserved}</td><td className={`py-3 font-semibold ${row.isLowStock ? "text-amber-700" : ""}`}>{row.quantityAvailable}</td></tr>)}</tbody></table></div>
                      )}
                    </div>
                  </div>}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
