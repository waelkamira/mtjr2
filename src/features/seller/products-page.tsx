"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type Market = {
  id: string; code: string; name: string;
  defaultCurrency: { code: string; minorUnit: number; symbol: string | null };
  currencies: Array<{ currency: { code: string; name: string; minorUnit: number; symbol: string | null } }>;
};
type Category = { id: string; name: string; children: Category[] };
type Brand = { id: string; name: string };
type Product = {
  id: string; name: string; slug: string; description: string | null; status: string; approvalStatus: string;
  rejectionReason: string | null; updatedAt: string;
  media: Array<{ url: string; altText: string | null }>;
  variants: Array<{ id: string; sku: string; name: string | null; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string }> }>;
};
type Store = { id: string; name: string; markets: Array<{ market: { id: string } }> };
type Workspace = { stores: Store[] };

async function json<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}
function flatten(items: Category[], prefix = ""): Array<{ id: string; label: string }> {
  return items.flatMap((item) => [
    { id: item.id, label: prefix + item.name },
    ...flatten(item.children ?? [], prefix + item.name + " / ")
  ]);
}

export default function SellerProductsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [marketPrices, setMarketPrices] = useState<Record<string, { currencyCode: string; amountMinor: string }>>({});
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const categoryOptions = useMemo(() => flatten(categories), [categories]);
  const enabledMarketIds = useMemo(() => new Set(stores.find((store) => store.id === storeId)?.markets.map((entry) => entry.market.id) ?? []), [stores, storeId]);
  const availableMarkets = markets.filter((market) => enabledMarketIds.has(market.id));

  const loadProducts = useCallback(async (id: string) => {
    if (!id) return;
    const result = await json<{ items: Product[] }>(await fetch(`/api/seller/products?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }));
    setProducts(result.items);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/seller/stores", { cache: "no-store" }).then((r) => json<Workspace>(r)),
      fetch("/api/markets").then((r) => json<{ items: Market[] }>(r)),
      fetch("/api/categories?limit=100").then((r) => json<{ items: Category[] }>(r)),
      fetch("/api/brands?limit=100").then((r) => json<{ items: Brand[] }>(r))
    ]).then(([workspace, marketResult, categoryResult, brandResult]) => {
      if (!active) return;
      setStores(workspace.stores);
      setMarkets(marketResult.items);
      setCategories(categoryResult.items);
      setBrands(brandResult.items);
      const initialStore = workspace.stores[0];
      if (initialStore) {
        setStoreId(initialStore.id);
        const enabled = new Set(initialStore.markets.map((entry) => entry.market.id));
        setMarketPrices(Object.fromEntries(marketResult.items.filter((market) => enabled.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amountMinor: "" }])));
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load seller catalog.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    loadProducts(storeId).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load products.");
    });
    return () => { active = false; };
  }, [storeId, loadProducts]);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const product = await json<{ id: string }>(await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, name, slug, description, ...(brandId ? { brandId } : {}),
          categoryIds: categoryId ? [categoryId] : [],
          media: imageUrl ? [{ url: imageUrl, altText: name, sortOrder: 0, isPrimary: true }] : [],
          variants: [{ sku, prices: availableMarkets.map((market) => ({ marketId: market.id, currencyCode: marketPrices[market.id]?.currencyCode ?? market.defaultCurrency.code, amountMinor: marketPrices[market.id]?.amountMinor ?? "" })) }]
        })
      }));
      setMessage(`Draft product created (${product.id}). It is awaiting platform review.`);
      setName(""); setSlug(""); setDescription(""); setSku(""); setImageUrl(""); setMarketPrices(Object.fromEntries(availableMarkets.map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amountMinor: "" }]))); setCategoryId(""); setBrandId("");
      await loadProducts(storeId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product could not be created.");
    } finally { setBusy(false); }
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/products/${encodeURIComponent(editingId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, slug: editSlug, description: editDescription })
      }));
      setEditingId("");
      setMessage("Draft product updated and returned to pending review.");
      await loadProducts(storeId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product could not be updated.");
    } finally { setBusy(false); }
  }

  async function publish(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(`/api/products/${encodeURIComponent(id)}/publish`, { method: "POST" }));
      setMessage("Product published.");
      await loadProducts(storeId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product could not be published.");
    } finally { setBusy(false); }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm";
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--color-ivory-50)]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/" className="text-2xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/seller" className="text-sm font-medium text-[var(--color-forest-900)]">← Seller workspace</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Catalog management</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Products</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Create draft products using your store&apos;s enabled markets. Product review and publication are enforced by the backend.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{message}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">Loading catalog…</p> : <div className="mt-8 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-semibold">Create product draft</h2>
          <label className="mt-5 grid gap-2 text-sm font-medium">Store<select className={inputClass} value={storeId} onChange={(e) => {
            const nextId = e.target.value;
            setStoreId(nextId);
            setProducts([]);
            const nextStore = stores.find((store) => store.id === nextId);
            const allowed = new Set(nextStore?.markets.map((entry) => entry.market.id) ?? []);
            setMarketPrices(Object.fromEntries(markets.filter((market) => allowed.has(market.id)).map((market) => [market.id, { currencyCode: market.defaultCurrency.code, amountMinor: "" }])));
          }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          {!stores.length ? <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm">Create a store and activate its markets before adding products.</p> : <form onSubmit={createProduct} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">Product name<input required minLength={2} maxLength={180} className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></label>
            <label className="grid gap-1 text-sm">URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">Description<textarea maxLength={12000} rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">SKU<input required maxLength={100} className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">Primary image URL<input required type="url" className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></label>
            <label className="grid gap-1 text-sm">Category<select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">No category</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Brand<select className={inputClass} value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <div className="grid gap-3 rounded-2xl bg-[var(--color-ivory-100)] p-4">
              <p className="text-sm font-semibold">Prices for every enabled store market</p>
              {!availableMarkets.length && <p className="text-xs text-amber-800">This store has no active markets enabled.</p>}
              {availableMarkets.map((market) => {
                const draft = marketPrices[market.id] ?? { currencyCode: market.defaultCurrency.code, amountMinor: "" };
                const currencies = market.currencies.map((entry) => entry.currency);
                const currency = currencies.find((item) => item.code === draft.currencyCode) ?? market.defaultCurrency;
                return <div key={market.id} className="grid gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
                  <p className="text-sm font-semibold">{market.name}</p>
                  <label className="grid gap-1 text-sm">Currency<select required className={inputClass} value={draft.currencyCode} onChange={(e) => setMarketPrices((current) => ({ ...current, [market.id]: { ...draft, currencyCode: e.target.value } }))}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
                  <label className="grid gap-1 text-sm">Price in minor units<input required inputMode="numeric" pattern="[0-9]+" className={inputClass} value={draft.amountMinor} onChange={(e) => setMarketPrices((current) => ({ ...current, [market.id]: { ...draft, amountMinor: e.target.value } }))} placeholder="e.g. 1299" /><span className="text-xs text-[var(--muted)]">Integer minor units · precision {currency.minorUnit}.</span></label>
                </div>;
              })}
            </div>
            <button disabled={busy || !storeId || !availableMarkets.length || availableMarkets.some((market) => !/^(0|[1-9][0-9]{0,17})$/.test(marketPrices[market.id]?.amountMinor ?? ""))} className="mt-2 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Create draft product"}</button>
          </form>}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-semibold">Store catalog</h2>
          {!products.length ? <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-5 text-sm text-[var(--muted)]">No products in this store yet.</p> : <div className="mt-4 divide-y divide-[var(--border)]">{products.map((product) => <article key={product.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">/{product.slug} · {product.variants.length} variants</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-[var(--color-ivory-100)] px-2.5 py-1 text-xs">{product.status}</span><span className="rounded-full bg-[var(--color-sage-100)] px-2.5 py-1 text-xs">{product.approvalStatus}</span></div>{product.rejectionReason && <p className="mt-2 text-xs text-red-700">Review: {product.rejectionReason}</p>}</div>
            <div className="flex flex-wrap gap-2">
              {product.status === "DRAFT" && <button disabled={busy} onClick={() => { setEditingId(product.id); setEditName(product.name); setEditSlug(product.slug); setEditDescription(product.description ?? ""); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">Edit draft</button>}
              {product.status === "DRAFT" && product.approvalStatus === "APPROVED" && <button disabled={busy} onClick={() => publish(product.id)} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Publish</button>}
            </div>
          </article>)}</div>}
          {editingId && <form onSubmit={saveProductEdit} className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] p-4">
            <h3 className="font-semibold">Edit draft product</h3>
            <label className="grid gap-1 text-sm">Name<input required minLength={2} maxLength={180} className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={editSlug} onChange={(e) => setEditSlug(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">Description<textarea maxLength={12000} rows={3} className={inputClass} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></label>
            <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2 text-xs font-semibold text-white">Save changes</button><button type="button" onClick={() => setEditingId("")} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs">Cancel</button></div>
          </form>}
        </section>
      </div>}
    </div>
  </main>;
}
