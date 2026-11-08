"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

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
  const { locale } = useLocale();
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
  const inventoryTotals = inventory.reduce((total, row) => ({
    onHand: total.onHand + row.quantityOnHand,
    quarantined: total.quarantined + row.quantityQuarantined,
    reserved: total.reserved + row.quantityReserved,
    available: total.available + row.quantityAvailable,
    lowStock: total.lowStock + (row.isLowStock ? 1 : 0)
  }), { onHand: 0, quarantined: 0, reserved: 0, available: 0, lowStock: 0 });
  const transferStatuses = transfers.reduce((counts, transfer) => {
    counts[transfer.status] = (counts[transfer.status] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const warehouseStock = warehouses.map((warehouse) => ({
    label: warehouse.name,
    value: inventory.filter((row) => row.warehouse.id === warehouse.id).reduce((sum, row) => sum + row.quantityAvailable, 0)
  })).filter((row) => row.value > 0).slice(0, 8);

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
      const savedId = localStorage.getItem("mtjr.activeStoreId") || "";
      const initialStore = workspace.stores.find((item) => item.id === savedId) ?? workspace.stores[0];
      if (initialStore) {
        setStoreId(initialStore.id);
        setAdjustWarehouseId(initialStore.warehouses[0]?.id ?? "");
        setSourceWarehouseId(initialStore.warehouses[0]?.id ?? "");
        setDestinationWarehouseId(initialStore.warehouses[1]?.id ?? "");
        localStorage.setItem("mtjr.activeStoreId", initialStore.id);
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
      setWarehouseCode(""); setWarehouseName("");       setNotice(translate(locale, "Warehouse created.", "تم إنشاء المستودع.")); toast.success(translate(locale, "Warehouse created.", "تم إنشاء المستودع."));
      if (!adjustWarehouseId) setAdjustWarehouseId(warehouse.id);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to create warehouse.", "تعذر إنشاء المستودع."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch("/api/seller/inventory/adjustments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId: adjustWarehouseId, variantId: adjustVariantId, quantityDelta: Number(quantityDelta), idempotencyKey: crypto.randomUUID(), note: adjustNote || undefined })
      }));
      setNotice(translate(locale, "Stock adjustment recorded.", "تم تسجيل تعديل المخزون.")); toast.success(translate(locale, "Stock adjustment recorded.", "تم تسجيل تعديل المخزون."));
      await refreshStore(storeId, search);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to adjust stock.", "تعذر تعديل المخزون."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch("/api/seller/inventory/transfers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWarehouseId, destinationWarehouseId, reference: transferReference || undefined, idempotencyKey: crypto.randomUUID(), items: [{ variantId: transferVariantId, quantity: Number(transferQuantity) }] })
      }));
      setNotice(translate(locale, "Transfer draft created.", "تم إنشاء مسودة النقل.")); toast.success(translate(locale, "Transfer draft created.", "تم إنشاء مسودة النقل."));
      await refreshStore(storeId, search);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to create transfer.", "تعذر إنشاء عملية النقل."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function processTransfer(id: string, action: "ship" | "receive") {
    setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch(`/api/seller/inventory/transfers/${encodeURIComponent(id)}/${action}`, { method: "POST" }));
      setNotice(action === "ship" ? translate(locale, "Transfer shipped; source stock was deducted.", "تم شحن النقل وخصم الكمية من مخزون المصدر.") : translate(locale, "Transfer received; destination stock was credited.", "تم استلام النقل وإضافة الكمية إلى مخزون الوجهة.")); toast.success(action === "ship" ? translate(locale, "Transfer shipped.", "تم شحن عملية النقل.") : translate(locale, "Transfer received.", "تم استلام عملية النقل."));
      await refreshStore(storeId, search);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to process transfer.", "تعذرت معالجة عملية النقل."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm";
  const button = "rounded-xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  return <main className="min-h-screen bg-transparent">
    
    <div className="mx-auto max-w-[1440px] px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{translate(locale, "Operations", "العمليات")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Inventory & warehouses", "المخزون والمستودعات")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Manage warehouse stock and internal transfers. All stock changes are validated, transactional, and audited by the backend.", "أدِر مخزون المستودعات وعمليات النقل الداخلية. يتحقق النظام الخلفي من جميع تغييرات المخزون وينفذها ضمن معاملات ويسجلها في التدقيق.")}</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">{translate(locale, "Loading inventory…", "جارٍ تحميل المخزون…")}</p> : <div className="mt-8 grid gap-6">
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)]">
          <label className="grid max-w-md gap-2 text-sm font-medium">{translate(locale, "Store", "المتجر")}<select className={field} value={storeId} onChange={(e) => { const id = e.target.value; const store = stores.find((item) => item.id === id); setStoreId(id); localStorage.setItem("mtjr.activeStoreId", id); setInventory([]); setProducts([]); setTransfers([]); setAdjustWarehouseId(store?.warehouses[0]?.id ?? ""); setSourceWarehouseId(store?.warehouses[0]?.id ?? ""); setDestinationWarehouseId(store?.warehouses[1]?.id ?? ""); }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        </section>
        <section aria-label="Inventory analytics" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricBarChart title="Stock composition" description="Live totals for the selected store and current inventory filter." rows={[
            { label: "Sellable on hand", value: inventoryTotals.onHand, color: "bg-sky-500" },
            { label: "Reserved", value: inventoryTotals.reserved, color: "bg-amber-500" },
            { label: "Quarantined", value: inventoryTotals.quarantined, color: "bg-rose-500" },
            { label: "Available", value: inventoryTotals.available, color: "bg-emerald-500" }
          ]} />
          <MetricBarChart title="Inventory risk" description="Stock record counts from the currently loaded inventory list." rows={[
            { label: "Low stock records", value: inventoryTotals.lowStock, color: "bg-rose-500" },
            { label: "Healthy stock records", value: Math.max(0, inventory.length - inventoryTotals.lowStock), color: "bg-emerald-500" }
          ]} />
          <MetricBarChart title="Available stock by warehouse" rows={warehouseStock.map((row, index) => ({
            ...row, color: ["bg-indigo-500", "bg-violet-500", "bg-cyan-500", "bg-teal-500", "bg-orange-500", "bg-fuchsia-500", "bg-blue-500", "bg-lime-500"][index]
          }))} />
          <MetricBarChart title="Internal transfer pipeline" rows={Object.entries(transferStatuses).map(([status, value], index) => ({
            label: status.replaceAll("_", " ").toLowerCase(), value,
            color: ["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500"][index % 5]
          }))} />
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)]"><h2 className="text-lg font-semibold">{translate(locale, "Add warehouse", "إضافة مستودع")}</h2><form onSubmit={createWarehouse} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">{translate(locale, "Warehouse code", "رمز المستودع")}<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" className={field} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={120} className={field} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} /></label><button disabled={busy || !storeId} className={button}>{translate(locale, "Create warehouse", "إنشاء مستودع")}</button></form></section>
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)] lg:col-span-2"><h2 className="text-lg font-semibold">{translate(locale, "Stock adjustment", "تعديل المخزون")}</h2><form onSubmit={adjustStock} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">{translate(locale, "Warehouse", "المستودع")}<select required className={field} value={adjustWarehouseId} onChange={(e) => setAdjustWarehouseId(e.target.value)}>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Product variant", "متغير المنتج")}<select required className={field} value={adjustVariantId} onChange={(e) => setAdjustVariantId(e.target.value)}><option value="">{translate(locale, "Select variant", "اختر متغيرًا")}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.productName} · {variant.sku}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Quantity change (+/-)", "تغيير الكمية (+/−)")}<input required type="number" step="1" min="-1000000" max="1000000" className={field} value={quantityDelta} onChange={(e) => setQuantityDelta(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Note", "ملاحظة")}<input maxLength={500} className={field} value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} /></label><button disabled={busy || !adjustWarehouseId || !adjustVariantId || !Number.isInteger(Number(quantityDelta)) || Number(quantityDelta) === 0} className={button + " sm:col-span-2"}>{translate(locale, "Record stock adjustment", "تسجيل تعديل المخزون")}</button></form></section>
        </div>
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)]"><h2 className="text-lg font-semibold">{translate(locale, "Current stock", "المخزون الحالي")}</h2><label className="mt-4 block max-w-xl text-xs font-medium">{translate(locale, "Search inventory", "البحث في المخزون")}<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={120} placeholder={translate(locale, "Product, SKU, warehouse or code", "المنتج أو SKU أو المستودع أو الرمز")} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"/></label>{!inventory.length ? <p className="mt-4 text-sm text-[var(--muted)]">{search ? translate(locale, "No inventory records match this search.", "لا توجد سجلات مخزون تطابق هذا البحث.") : translate(locale, "No inventory records in this store yet.", "لا توجد سجلات مخزون في هذا المتجر بعد.")}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3">{translate(locale, "Product / SKU", "المنتج / SKU")}</th><th>{translate(locale, "Warehouse", "المستودع")}</th><th>{translate(locale, "Sellable on hand", "المخزون القابل للبيع")}</th><th>{translate(locale, "Quarantined", "قيد الحجر")}</th><th>{translate(locale, "Reserved", "محجوز")}</th><th>{translate(locale, "Available", "المتاح")}</th></tr></thead><tbody>{inventory.map((row) => <tr key={row.id} className="border-b border-[var(--border)]"><td className="py-3 font-medium">{row.variant.product.name}<span className="block text-xs text-[var(--muted)]">{row.variant.sku}</span></td><td>{row.warehouse.name}</td><td>{row.quantityOnHand}</td><td>{row.quantityQuarantined}</td><td>{row.quantityReserved}</td><td><span className={row.isLowStock ? "font-semibold text-amber-700" : ""}>{row.quantityAvailable}</span></td></tr>)}</tbody></table></div>}</section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)]"><h2 className="text-lg font-semibold">{translate(locale, "Create stock transfer", "إنشاء نقل مخزون")}</h2><form onSubmit={createTransfer} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">{translate(locale, "Source warehouse", "المستودع المصدر")}<select required className={field} value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Destination warehouse", "المستودع الوجهة")}<select required className={field} value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>{warehouses.filter((w) => w.id !== sourceWarehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Variant", "المتغير")}<select required className={field} value={transferVariantId} onChange={(e) => setTransferVariantId(e.target.value)}><option value="">{translate(locale, "Select variant", "اختر متغيرًا")}</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.productName} · {v.sku}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Quantity", "الكمية")}<input required type="number" min="1" max="1000000" step="1" className={field} value={transferQuantity} onChange={(e) => setTransferQuantity(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Reference (optional)", "مرجع (اختياري)")}<input maxLength={100} className={field} value={transferReference} onChange={(e) => setTransferReference(e.target.value)} /></label><button disabled={busy || warehouses.length < 2 || !transferVariantId || !sourceWarehouseId || !destinationWarehouseId || sourceWarehouseId === destinationWarehouseId || !Number.isInteger(Number(transferQuantity)) || Number(transferQuantity) < 1} className={button}>{translate(locale, "Create transfer draft", "إنشاء مسودة نقل")}</button></form></section>
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)]"><h2 className="text-lg font-semibold">{translate(locale, "Transfer history", "سجل النقل")}</h2>{!transfers.length ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No transfers recorded yet.", "لا توجد عمليات نقل مسجلة بعد.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">{transfers.map((transfer) => <article key={transfer.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{transfer.reference || transfer.id.slice(0, 10)}</p><span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs">{translate(locale, transfer.status, transfer.status === "DRAFT" ? "مسودة" : transfer.status === "SHIPPED" ? "تم الشحن" : transfer.status)}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{transfer.sourceWarehouse.name} → {transfer.destinationWarehouse.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{transfer.items.map((item) => item.variant.sku + " × " + item.quantity).join(", ")}</p><div className="mt-3 flex gap-2">{transfer.status === "DRAFT" && <button disabled={busy} onClick={() => processTransfer(transfer.id, "ship")} className={button}>{translate(locale, "Ship", "شحن")}</button>}{transfer.status === "SHIPPED" && <button disabled={busy} onClick={() => processTransfer(transfer.id, "receive")} className={button}>{translate(locale, "Receive", "استلام")}</button>}</div></article>)}</div>}</section>
        </div>
      </div>}
    </div>
  </main>;
}
