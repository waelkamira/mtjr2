"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type Warehouse = { id: string; code: string; name: string };
type Store = { id: string; name: string; warehouses: Warehouse[] };
type Workspace = { stores: Store[] };
type Variant = { id: string; sku: string; name: string | null };
type Product = { id: string; name: string; variants: Variant[] };
type InventoryRow = {
  id: string; quantityOnHand: number; quantityQuarantined: number; quantityReserved: number; quantityAvailable: number; reorderPoint: number; isLowStock: boolean;
  warehouse: Warehouse; variant: { id: string; sku: string; name: string | null; product: { name: string; slug: string } };
};
type Transfer = {
  id: string; reference: string | null; status: string; createdAt: string; shippedAt: string | null; receivedAt: string | null;
  sourceWarehouse: Warehouse; destinationWarehouse: Warehouse;
  items: Array<{ quantity: number; variant: { id: string; sku: string; name: string | null; product: { name: string } } }>;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export default function SellerInventoryPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [adjustWarehouseId, setAdjustWarehouseId] = useState("");
  const [adjustVariantId, setAdjustVariantId] = useState("");
  const [quantityDelta, setQuantityDelta] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [transferVariantId, setTransferVariantId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [transferReference, setTransferReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedStore = stores.find((store) => store.id === storeId);
  const warehouses = selectedStore?.warehouses ?? [];
  const variants = useMemo(() => products.flatMap((product) => product.variants.map((variant) => ({ ...variant, productName: product.name }))), [products]);

  const refreshStore = useCallback(async (id: string, q = "") => {
    if (!id) return;
    const params = new URLSearchParams({ storeId: id });
    if (q.trim()) params.set("q", q.trim());
    const [stock, productResult, transferResult] = await Promise.all([
      fetch(`/api/seller/inventory?${params.toString()}`, { cache: "no-store" }).then((r) => readJson<InventoryRow[]>(r)),
      fetch(`/api/seller/products?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => readJson<{ items: Product[] }>(r)),
      fetch(`/api/seller/inventory/transfers?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => readJson<{ items: Transfer[] }>(r))
    ]);
    setInventory(stock);
    setProducts(productResult.items);
    setTransfers(transferResult.items);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/seller/stores", { cache: "no-store" }).then((r) => readJson<Workspace>(r)).then((workspace) => {
      if (!active) return;
      setStores(workspace.stores);
      if (workspace.stores[0]) {
        setStoreId(workspace.stores[0].id);
        setAdjustWarehouseId(workspace.stores[0].warehouses[0]?.id ?? "");
        setSourceWarehouseId(workspace.stores[0].warehouses[0]?.id ?? "");
        setDestinationWarehouseId(workspace.stores[0].warehouses[1]?.id ?? "");
      }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load stores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    const timer = window.setTimeout(() => { void refreshStore(storeId, search).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load inventory.");
    }); }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storeId, search, refreshStore]);

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const warehouse = await readJson<Warehouse>(await fetch("/api/seller/warehouses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, code: warehouseCode, name: warehouseName })
      }));
      setStores((current) => current.map((store) => store.id === storeId ? { ...store, warehouses: [...store.warehouses, warehouse] } : store));
      setWarehouseCode(""); setWarehouseName(""); setNotice("Warehouse created.");
      if (!adjustWarehouseId) setAdjustWarehouseId(warehouse.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create warehouse."); }
    finally { setBusy(false); }
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch("/api/seller/inventory/adjustments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId: adjustWarehouseId, variantId: adjustVariantId, quantityDelta: Number(quantityDelta), idempotencyKey: crypto.randomUUID(), note: adjustNote || undefined })
      }));
      setNotice("Stock adjustment recorded.");
      await refreshStore(storeId, search);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to adjust stock."); }
    finally { setBusy(false); }
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch("/api/seller/inventory/transfers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWarehouseId, destinationWarehouseId, reference: transferReference || undefined, idempotencyKey: crypto.randomUUID(), items: [{ variantId: transferVariantId, quantity: Number(transferQuantity) }] })
      }));
      setNotice("Transfer draft created.");
      await refreshStore(storeId, search);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create transfer."); }
    finally { setBusy(false); }
  }

  async function processTransfer(id: string, action: "ship" | "receive") {
    setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch(`/api/seller/inventory/transfers/${encodeURIComponent(id)}/${action}`, { method: "POST" }));
      setNotice(action === "ship" ? "Transfer shipped; source stock was deducted." : "Transfer received; destination stock was credited.");
      await refreshStore(storeId, search);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to process transfer."); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm";
  const button = "rounded-xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--background)]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/" className="text-2xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/seller" className="text-sm font-medium text-[var(--color-ink-800)]">← Seller workspace</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">Operations</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">Inventory & warehouses</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Manage warehouse stock and internal transfers. All stock changes are validated, transactional, and audited by the backend.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">Loading inventory…</p> : <div className="mt-8 grid gap-6">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <label className="grid max-w-md gap-2 text-sm font-medium">Store<select className={field} value={storeId} onChange={(e) => { const id = e.target.value; const store = stores.find((item) => item.id === id); setStoreId(id); setInventory([]); setProducts([]); setTransfers([]); setAdjustWarehouseId(store?.warehouses[0]?.id ?? ""); setSourceWarehouseId(store?.warehouses[0]?.id ?? ""); setDestinationWarehouseId(store?.warehouses[1]?.id ?? ""); }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">Add warehouse</h2><form onSubmit={createWarehouse} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">Warehouse code<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" className={field} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} /></label><label className="grid gap-1 text-sm">Name<input required minLength={2} maxLength={120} className={field} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} /></label><button disabled={busy || !storeId} className={button}>Create warehouse</button></form></section>
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:col-span-2"><h2 className="text-lg font-semibold">Stock adjustment</h2><form onSubmit={adjustStock} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Warehouse<select required className={field} value={adjustWarehouseId} onChange={(e) => setAdjustWarehouseId(e.target.value)}>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="grid gap-1 text-sm">Product variant<select required className={field} value={adjustVariantId} onChange={(e) => setAdjustVariantId(e.target.value)}><option value="">Select variant</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.productName} · {variant.sku}</option>)}</select></label><label className="grid gap-1 text-sm">Quantity change (+/-)<input required type="number" step="1" min="-1000000" max="1000000" className={field} value={quantityDelta} onChange={(e) => setQuantityDelta(e.target.value)} /></label><label className="grid gap-1 text-sm">Note<input maxLength={500} className={field} value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} /></label><button disabled={busy || !adjustWarehouseId || !adjustVariantId || !Number.isInteger(Number(quantityDelta)) || Number(quantityDelta) === 0} className={button + " sm:col-span-2"}>Record stock adjustment</button></form></section>
        </div>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">Current stock</h2><label className="mt-4 block max-w-xl text-xs font-medium">Search inventory<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={120} placeholder="Product, SKU, warehouse or code" className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"/></label>{!inventory.length ? <p className="mt-4 text-sm text-[var(--muted)]">{search ? "No inventory records match this search." : "No inventory records in this store yet."}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3">Product / SKU</th><th>Warehouse</th><th>Sellable on hand</th><th>Quarantined</th><th>Reserved</th><th>Available</th></tr></thead><tbody>{inventory.map((row) => <tr key={row.id} className="border-b border-[var(--border)]"><td className="py-3 font-medium">{row.variant.product.name}<span className="block text-xs text-[var(--muted)]">{row.variant.sku}</span></td><td>{row.warehouse.name}</td><td>{row.quantityOnHand}</td><td>{row.quantityQuarantined}</td><td>{row.quantityReserved}</td><td><span className={row.isLowStock ? "font-semibold text-amber-700" : ""}>{row.quantityAvailable}</span></td></tr>)}</tbody></table></div>}</section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">Create stock transfer</h2><form onSubmit={createTransfer} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">Source warehouse<select required className={field} value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-1 text-sm">Destination warehouse<select required className={field} value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>{warehouses.filter((w) => w.id !== sourceWarehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-1 text-sm">Variant<select required className={field} value={transferVariantId} onChange={(e) => setTransferVariantId(e.target.value)}><option value="">Select variant</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.productName} · {v.sku}</option>)}</select></label><label className="grid gap-1 text-sm">Quantity<input required type="number" min="1" max="1000000" step="1" className={field} value={transferQuantity} onChange={(e) => setTransferQuantity(e.target.value)} /></label><label className="grid gap-1 text-sm">Reference (optional)<input maxLength={100} className={field} value={transferReference} onChange={(e) => setTransferReference(e.target.value)} /></label><button disabled={busy || warehouses.length < 2 || !transferVariantId || !sourceWarehouseId || !destinationWarehouseId || sourceWarehouseId === destinationWarehouseId || !Number.isInteger(Number(transferQuantity)) || Number(transferQuantity) < 1} className={button}>Create transfer draft</button></form></section>
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">Transfer history</h2>{!transfers.length ? <p className="mt-4 text-sm text-[var(--muted)]">No transfers recorded yet.</p> : <div className="mt-4 divide-y divide-[var(--border)]">{transfers.map((transfer) => <article key={transfer.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{transfer.reference || transfer.id.slice(0, 10)}</p><span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs">{transfer.status}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{transfer.sourceWarehouse.name} → {transfer.destinationWarehouse.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{transfer.items.map((item) => item.variant.sku + " × " + item.quantity).join(", ")}</p><div className="mt-3 flex gap-2">{transfer.status === "DRAFT" && <button disabled={busy} onClick={() => processTransfer(transfer.id, "ship")} className={button}>Ship</button>}{transfer.status === "SHIPPED" && <button disabled={busy} onClick={() => processTransfer(transfer.id, "receive")} className={button}>Receive</button>}</div></article>)}</div>}</section>
        </div>
      </div>}
    </div>
  </main>;
}
