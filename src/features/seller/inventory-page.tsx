"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

type Warehouse = { id: string; code: string; name: string; isActive: boolean };
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
type Movement = {
  id: string; type: string; quantityDelta: number; quarantinedDelta: number; referenceType: string | null; referenceId: string | null;
  note: string | null; createdAt: string;
  inventory: { warehouse: Warehouse; variant: { sku: string; product: { name: string } } };
};
type StockCountSummary = {
  id: string; status: string; note: string | null; openedAt: string; completedAt: string | null;
  warehouse: Warehouse; _count: { lines: number }; lines: Array<{ countedQuantity: number | null }>;
};
type StockCountLine = {
  id: string; expectedQuantity: number; countedQuantity: number | null; note: string | null;
  inventory: { id: string; quantityOnHand: number; quantityReserved: number; quantityQuarantined: number; variant: { sku: string; name: string | null; product: { name: string } } };
};
type StockCountDetail = {
  id: string; status: string; note: string | null; openedAt: string; completedAt: string | null;
  warehouse: Warehouse; lines: StockCountLine[];
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
  const [inventoryCursor, setInventoryCursor] = useState<string | null>(null);
  const [loadingInventoryMore, setLoadingInventoryMore] = useState(false);
  const [search, setSearch] = useState("");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementCursor, setMovementCursor] = useState<string | null>(null);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [stockCounts, setStockCounts] = useState<StockCountSummary[]>([]);
  const [activeStockCount, setActiveStockCount] = useState<StockCountDetail | null>(null);
  const [countWarehouseId, setCountWarehouseId] = useState("");
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({});
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [editingWarehouseCode, setEditingWarehouseCode] = useState("");
  const [editingWarehouseName, setEditingWarehouseName] = useState("");
  const [adjustWarehouseId, setAdjustWarehouseId] = useState("");
  const [adjustVariantId, setAdjustVariantId] = useState("");
  const [quantityDelta, setQuantityDelta] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");
  const [quarantineWarehouseId, setQuarantineWarehouseId] = useState("");
  const [quarantineVariantId, setQuarantineVariantId] = useState("");
  const [quarantineQuantity, setQuarantineQuantity] = useState("1");
  const [quarantineDecision, setQuarantineDecision] = useState<"RELEASE" | "DISPOSE">("RELEASE");
  const [quarantineNote, setQuarantineNote] = useState("");
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
  const allWarehouses = selectedStore?.warehouses ?? [];
  const warehouses = allWarehouses.filter((warehouse) => warehouse.isActive);
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

  const refreshStore = useCallback(async (id: string, q = "", isCurrent: () => boolean = () => true) => {
    if (!id) return;
    const params = new URLSearchParams({ storeId: id });
    if (q.trim()) params.set("q", q.trim());
    const [stock, productResult, transferResult, movementResult, countResult] = await Promise.all([
      fetch(`/api/seller/inventory?${params.toString()}`, { cache: "no-store" }).then((r) => readJson<{ items: InventoryRow[]; nextCursor: string | null }>(r)),
      fetch(`/api/seller/products?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => readJson<{ items: Product[] }>(r)),
      fetch(`/api/seller/inventory/transfers?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => readJson<{ items: Transfer[] }>(r)),
      fetch(`/api/seller/inventory/movements?storeId=${encodeURIComponent(id)}&limit=100`, { cache: "no-store" }).then((r) => readJson<{ items: Movement[]; nextCursor: string | null }>(r)),
      fetch(`/api/seller/inventory/counts?storeId=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => readJson<{ items: StockCountSummary[] }>(r)).catch((cause: unknown) => { if (isCurrent()) setError(cause instanceof Error ? cause.message : "Stock count service is unavailable."); return { items: [] as StockCountSummary[] }; })
    ]);
    if (!isCurrent()) return;
    setInventory(stock.items);
    setInventoryCursor(stock.nextCursor ?? null);
    setProducts(productResult.items);
    setTransfers(transferResult.items);
    setMovements(movementResult.items);
    setMovementCursor(movementResult.nextCursor ?? null);
    setStockCounts(countResult.items);
  }, []);

  async function loadMoreInventory() {
    if (!storeId || !inventoryCursor || loadingInventoryMore) return;
    setLoadingInventoryMore(true);
    try {
      const params = new URLSearchParams({ storeId, cursor: inventoryCursor });
      if (search.trim()) params.set("q", search.trim());
      const result = await readJson<{ items: InventoryRow[]; nextCursor: string | null }>(
        await fetch(`/api/seller/inventory?${params.toString()}`, { cache: "no-store" })
      );
      setInventory((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setInventoryCursor(result.nextCursor ?? null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to load more inventory.", "تعذر تحميل المزيد من المخزون.");
      setError(message);
      toast.error(message);
    } finally {
      setLoadingInventoryMore(false);
    }
  }

  async function loadOlderMovements() {
    if (!storeId || !movementCursor || loadingMovements) return;
    setLoadingMovements(true);
    try {
      const params = new URLSearchParams({ storeId, limit: "100", cursor: movementCursor });
      const result = await readJson<{ items: Movement[]; nextCursor: string | null }>(
        await fetch(`/api/seller/inventory/movements?${params.toString()}`, { cache: "no-store" })
      );
      setMovements((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setMovementCursor(result.nextCursor ?? null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to load older stock movements.", "تعذر تحميل حركات المخزون الأقدم.");
      setError(message);
      toast.error(message);
    } finally {
      setLoadingMovements(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/seller/stores", { cache: "no-store" }).then((r) => readJson<Workspace>(r)).then((workspace) => {
      if (!active) return;
      setStores(workspace.stores);
      let savedId = "";
      try { savedId = localStorage.getItem("mtjr.activeStoreId") || ""; } catch { /* Inventory remains usable without persistent browser storage. */ }
      const initialStore = workspace.stores.find((item) => item.id === savedId) ?? workspace.stores[0];
      if (initialStore) {
        setStoreId(initialStore.id);
        setAdjustWarehouseId(initialStore.warehouses.find((warehouse) => warehouse.isActive)?.id ?? "");
        setCountWarehouseId(initialStore.warehouses.find((warehouse) => warehouse.isActive)?.id ?? "");
        setSourceWarehouseId(initialStore.warehouses[0]?.id ?? "");
        setDestinationWarehouseId(initialStore.warehouses[1]?.id ?? "");
        try { localStorage.setItem("mtjr.activeStoreId", initialStore.id); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Inventory remains usable without persistent browser storage. */ }
      }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load stores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear store-scoped inventory before loading the newly selected warehouse context.
    setInventory([]);
    setProducts([]);
    setTransfers([]);
    setMovements([]);
    setStockCounts([]);
    setActiveStockCount(null);
    setCountDrafts({});
    const nextWarehouses = stores.find((store) => store.id === storeId)?.warehouses ?? [];
    const nextActiveWarehouse = nextWarehouses.find((warehouse) => warehouse.isActive)?.id ?? "";
    setAdjustWarehouseId(nextActiveWarehouse);
    setCountWarehouseId(nextActiveWarehouse);
    setSourceWarehouseId(nextWarehouses[0]?.id ?? "");
    setDestinationWarehouseId(nextWarehouses[1]?.id ?? "");
    setAdjustVariantId("");
    setQuarantineWarehouseId(nextActiveWarehouse);
    setQuarantineVariantId("");
    setTransferVariantId("");
    const timer = window.setTimeout(() => { void refreshStore(storeId, search, () => active).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load inventory.");
    }); }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storeId, search, refreshStore, stores]);

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
      if (!countWarehouseId) setCountWarehouseId(warehouse.id);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to create warehouse.", "تعذر إنشاء المستودع."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function saveWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingWarehouseId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await readJson<Warehouse>(await fetch(`/api/seller/warehouses/${encodeURIComponent(editingWarehouseId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editingWarehouseCode, name: editingWarehouseName })
      }));
      setStores((current) => current.map((store) => store.id === storeId ? { ...store, warehouses: store.warehouses.map((item) => item.id === updated.id ? updated : item) } : store));
      setEditingWarehouseId(""); setNotice(translate(locale, "Warehouse details saved.", "تم حفظ بيانات المستودع.")); toast.success(translate(locale, "Warehouse details saved.", "تم حفظ بيانات المستودع."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to update warehouse.", "تعذر تحديث المستودع."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function toggleWarehouse(warehouse: Warehouse) {
    const nextActive = warehouse.isActive === false;
    if (!nextActive && !window.confirm(translate(locale, "Deactivate this warehouse? It must have no stock and no pending transfers.", "هل تريد تعطيل هذا المستودع؟ يجب ألا يحتوي على مخزون أو عمليات نقل معلقة."))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await readJson<Warehouse>(await fetch(`/api/seller/warehouses/${encodeURIComponent(warehouse.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: nextActive })
      }));
      setStores((current) => current.map((store) => store.id === storeId ? { ...store, warehouses: store.warehouses.map((item) => item.id === updated.id ? updated : item) } : store));
      if (!updated.isActive) {
        setInventory((current) => current.filter((row) => row.warehouse.id !== updated.id));
        if (adjustWarehouseId === updated.id) setAdjustWarehouseId("");
        if (sourceWarehouseId === updated.id) setSourceWarehouseId("");
        if (destinationWarehouseId === updated.id) setDestinationWarehouseId("");
      }
      setNotice(updated.isActive ? translate(locale, "Warehouse reactivated.", "تمت إعادة تفعيل المستودع.") : translate(locale, "Warehouse deactivated.", "تم تعطيل المستودع."));
      toast.success(updated.isActive ? translate(locale, "Warehouse reactivated.", "تمت إعادة تفعيل المستودع.") : translate(locale, "Warehouse deactivated.", "تم تعطيل المستودع."));
      await refreshStore(storeId, search);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to change warehouse status.", "تعذر تغيير حالة المستودع."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }


  async function openStockCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!countWarehouseId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const session = await readJson<StockCountDetail>(await fetch("/api/seller/inventory/counts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId: countWarehouseId })
      }));
      setActiveStockCount(session);
      setCountDrafts(Object.fromEntries(session.lines.map((line) => [line.id, line.countedQuantity === null ? "" : String(line.countedQuantity)])));
      await refreshStore(storeId, search);
      setNotice(translate(locale, "Physical stock count opened. Record each item, then reconcile.", "تم فتح جلسة الجرد. أدخل الكمية الفعلية لكل صنف ثم اعتمد التسوية."));
      toast.success(translate(locale, "Stock count opened.", "تم فتح جلسة الجرد."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to open stock count.", "تعذر فتح جلسة الجرد."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function selectStockCount(id: string) {
    setBusy(true); setError("");
    try {
      const session = await readJson<StockCountDetail>(await fetch(`/api/seller/inventory/counts/${encodeURIComponent(id)}`, { cache: "no-store" }));
      setActiveStockCount(session);
      setCountDrafts(Object.fromEntries(session.lines.map((line) => [line.id, line.countedQuantity === null ? "" : String(line.countedQuantity)])));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to load stock count.", "تعذر تحميل جلسة الجرد."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function saveCountLine(line: StockCountLine) {
    const raw = countDrafts[line.id] ?? "";
    const countedQuantity = Number(raw);
    if (!raw.trim() || !Number.isSafeInteger(countedQuantity) || countedQuantity < 0) {
      setError(translate(locale, "Enter a whole counted quantity of zero or more.", "أدخل كمية صحيحة كاملة تساوي صفراً أو أكثر.")); return;
    }
    if (!activeStockCount) return;
    setBusy(true); setError("");
    try {
      const updated = await readJson<StockCountLine>(await fetch(`/api/seller/inventory/counts/${encodeURIComponent(activeStockCount.id)}/lines/${encodeURIComponent(line.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQuantity })
      }));
      setActiveStockCount((current) => current ? { ...current, lines: current.lines.map((item) => item.id === updated.id ? updated : item) } : current);
      setNotice(translate(locale, "Counted quantity saved.", "تم حفظ الكمية المعدودة."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to save count.", "تعذر حفظ الجرد."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function cancelCount() {
    if (!activeStockCount) return;
    if (!window.confirm(translate(locale, "Cancel this count session? No inventory will be changed.", "هل تريد إلغاء جلسة الجرد؟ لن يتم تعديل أي كمية في المخزون."))) return;
    setBusy(true); setError("");
    try {
      await readJson(await fetch(`/api/seller/inventory/counts/${encodeURIComponent(activeStockCount.id)}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" } }));
      setActiveStockCount((current) => current ? { ...current, status: "CANCELLED" } : current);
      await refreshStore(storeId, search);
      setNotice(translate(locale, "Count session cancelled without changing stock.", "تم إلغاء جلسة الجرد دون تغيير المخزون."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to cancel count.", "تعذر إلغاء الجرد."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  async function completeCount() {
    if (!activeStockCount) return;
    if (!window.confirm(translate(locale, "Reconcile this physical count and apply its variances to inventory?", "هل تريد اعتماد هذا الجرد وتطبيق الفروقات على المخزون؟"))) return;
    setBusy(true); setError("");
    try {
      const result = await readJson<{ status: string; adjustedLines: number; totalVariance: number }>(await fetch(`/api/seller/inventory/counts/${encodeURIComponent(activeStockCount.id)}/complete`, { method: "POST", headers: { "Content-Type": "application/json" } }));
      setNotice(translate(locale, `Count reconciled. ${result.adjustedLines} items adjusted; net variance ${result.totalVariance}.`, `تم اعتماد الجرد. تمت تسوية ${result.adjustedLines} أصناف؛ صافي الفرق ${result.totalVariance}.`));
      toast.success(translate(locale, "Stock count reconciled.", "تم اعتماد الجرد وتسوية المخزون."));
      setActiveStockCount((current) => current ? { ...current, status: result.status, completedAt: new Date().toISOString() } : current);
      await refreshStore(storeId, search);
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Unable to reconcile stock count.", "تعذر اعتماد الجرد."); setError(message); toast.error(message); }
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

  async function decideQuarantine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await readJson(await fetch("/api/seller/inventory/quarantine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: quarantineWarehouseId, variantId: quarantineVariantId,
          quantity: Number(quarantineQuantity), decision: quarantineDecision,
          idempotencyKey: crypto.randomUUID(), note: quarantineNote || undefined
        })
      }));
      const success = quarantineDecision === "RELEASE"
        ? translate(locale, "Inspected units released to sellable stock.", "تم تحرير الكمية المفحوصة إلى المخزون القابل للبيع.")
        : translate(locale, "Quarantined units marked as disposed.", "تم تسجيل إتلاف الكمية الموجودة في الحجر.");
      setNotice(success); toast.success(success); setQuarantineNote("");
      await refreshStore(storeId, search);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to process quarantined stock.", "تعذرت معالجة المخزون المحجور.");
      setError(message); toast.error(message);
    } finally { setBusy(false); }
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
  const button = "rounded-xl bg-[var(--action)] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_9px_rgba(255,140,28,.18)] transition-colors hover:bg-[var(--action-hover)] disabled:opacity-50";
  const movementLabel = (type: string) => {
    const labels: Record<string, string> = {
      RECEIPT: "استلام مخزون", RETURN_RECEIPT: "استلام مرتجع", SALE: "بيع",
      ORDER_CANCELLATION: "إلغاء طلب", ADJUSTMENT: "تعديل مخزون",
      TRANSFER_OUT: "تحويل صادر", TRANSFER_IN: "تحويل وارد"
    };
    const english = type.toLowerCase().replaceAll("_", " ");
    return translate(locale, english, labels[type] ?? english);
  };
  const transferStatusLabel = (status: string) => {
    const labels: Record<string, string> = { DRAFT: "مسودة", SHIPPED: "تم الشحن", RECEIVED: "تم الاستلام", CANCELLED: "ملغى" };
    const english = status.toLowerCase().replaceAll("_", " ");
    return translate(locale, english, labels[status] ?? english);
  };
  return <main className="min-h-screen bg-transparent">
    
    <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{translate(locale, "Operations", "العمليات")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Inventory & warehouses", "المخزون والمستودعات")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Manage warehouse stock and internal transfers. All stock changes are validated, transactional, and audited by the backend.", "أدِر مخزون المستودعات وعمليات النقل الداخلية. يتحقق النظام الخلفي من جميع تغييرات المخزون وينفذها ضمن معاملات ويسجلها في التدقيق.")}</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">{translate(locale, "Loading inventory…", "جارٍ تحميل المخزون…")}</p> : <div className="mt-8 grid gap-6">
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]">
          <label className="grid max-w-md gap-2 text-sm font-medium">{translate(locale, "Store", "المتجر")}<select className={field} value={storeId} onChange={(e) => { const id = e.target.value; const store = stores.find((item) => item.id === id); setStoreId(id); try { localStorage.setItem("mtjr.activeStoreId", id); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Store selection remains available for this session. */ } setInventory([]); setProducts([]); setTransfers([]); setMovements([]); setStockCounts([]); setActiveStockCount(null); setCountDrafts({}); setCountWarehouseId(store?.warehouses.find((warehouse) => warehouse.isActive)?.id ?? ""); setAdjustWarehouseId(store?.warehouses.find((warehouse) => warehouse.isActive)?.id ?? ""); setSourceWarehouseId(store?.warehouses[0]?.id ?? ""); setDestinationWarehouseId(store?.warehouses[1]?.id ?? ""); }}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        </section>
        <section aria-label="Inventory analytics" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricBarChart title={translate(locale, "Stock composition", "توزيع المخزون")} description={translate(locale, "Live totals for the selected store and current inventory filter.", "إجماليات مباشرة للمتجر المحدد ومرشح المخزون الحالي.")} rows={[
            { label: translate(locale, "Sellable on hand", "المخزون القابل للبيع"), value: inventoryTotals.onHand, color: "bg-sky-500" },
            { label: translate(locale, "Reserved", "محجوز"), value: inventoryTotals.reserved, color: "bg-amber-500" },
            { label: translate(locale, "Quarantined", "قيد الحجر"), value: inventoryTotals.quarantined, color: "bg-rose-500" },
            { label: translate(locale, "Available", "متاح"), value: inventoryTotals.available, color: "bg-emerald-500" }
          ]} />
          <MetricBarChart title={translate(locale, "Inventory risk", "مخاطر المخزون")} description={translate(locale, "Stock record counts from the currently loaded inventory list.", "عدد سجلات المخزون المحمّلة حالياً.")} rows={[
            { label: translate(locale, "Low stock records", "سجلات المخزون المنخفض"), value: inventoryTotals.lowStock, color: "bg-rose-500" },
            { label: translate(locale, "Healthy stock records", "سجلات المخزون السليم"), value: Math.max(0, inventory.length - inventoryTotals.lowStock), color: "bg-emerald-500" }
          ]} />
          <MetricBarChart title={translate(locale, "Available stock by warehouse", "المخزون المتاح حسب المستودع")} rows={warehouseStock.map((row, index) => ({
            ...row, color: ["bg-indigo-500", "bg-violet-500", "bg-cyan-500", "bg-teal-500", "bg-[var(--orange)]", "bg-fuchsia-500", "bg-blue-500", "bg-lime-500"][index]
          }))} />
          <MetricBarChart title={translate(locale, "Internal transfer pipeline", "حركة التحويلات الداخلية")} rows={Object.entries(transferStatuses).map(([status, value], index) => ({
            label: status.replaceAll("_", " ").toLowerCase(), value,
            color: ["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500"][index % 5]
          }))} />
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]"><h2 className="text-lg font-semibold">{translate(locale, "Add warehouse", "إضافة مستودع")}</h2><form onSubmit={createWarehouse} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">{translate(locale, "Warehouse code", "رمز المستودع")}<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" className={field} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={120} className={field} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} /></label><button disabled={busy || !storeId} className={button}>{translate(locale, "Create warehouse", "إنشاء مستودع")}</button></form></section>
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)] lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{translate(locale, "Warehouse management", "إدارة المستودعات")}</h2><span className="text-xs text-[var(--muted)]">{warehouses.length} {translate(locale, "warehouses", "مستودعات")}</span></div>
            {!warehouses.length ? <p className="mt-3 text-sm text-[var(--muted)]">{translate(locale, "No warehouses have been created for this store.", "لم يتم إنشاء مستودعات لهذا المتجر بعد.")}</p> : <div className="mt-3 grid gap-3 md:grid-cols-2">{allWarehouses.map((warehouse) => <article key={warehouse.id} className="rounded-2xl border border-white/80 bg-white/65 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{warehouse.name}</p><p className="text-xs text-[var(--muted)]">{warehouse.code}</p></div><span className={warehouse.isActive === false ? "rounded-full bg-slate-200 px-2 py-1 text-xs" : "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800"}>{warehouse.isActive === false ? translate(locale, "Inactive", "معطل") : translate(locale, "Active", "نشط")}</span></div>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setEditingWarehouseId(warehouse.id); setEditingWarehouseCode(warehouse.code); setEditingWarehouseName(warehouse.name); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit details", "تعديل البيانات")}</button><button type="button" disabled={busy} onClick={() => void toggleWarehouse(warehouse)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{warehouse.isActive === false ? translate(locale, "Reactivate", "إعادة التفعيل") : translate(locale, "Deactivate", "تعطيل")}</button></div>
            </article>)}</div>}
            {editingWarehouseId && <form onSubmit={saveWarehouse} className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-white/60 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-1 text-sm">{translate(locale, "Warehouse code", "رمز المستودع")}<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" className={field} value={editingWarehouseCode} onChange={(e) => setEditingWarehouseCode(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={120} className={field} value={editingWarehouseName} onChange={(e) => setEditingWarehouseName(e.target.value)} /></label>
              <div className="flex items-end gap-2"><button disabled={busy} className={button}>{translate(locale, "Save changes", "حفظ التغييرات")}</button><button type="button" disabled={busy} onClick={() => setEditingWarehouseId("")} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">{translate(locale, "Cancel", "إلغاء")}</button></div>
            </form>}
          </section>
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)] lg:col-span-3">
            <h2 className="text-lg font-semibold">{translate(locale, "Warehouse management", "إدارة المستودعات")}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">{allWarehouses.map((warehouse) => <article key={warehouse.id} className="rounded-2xl border border-white/80 bg-white/65 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{warehouse.name}</p><p className="text-xs text-[var(--muted)]">{warehouse.code}</p></div><StatusBadge locale={locale} status={warehouse.isActive ? "ACTIVE" : "INACTIVE"} /></div>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setEditingWarehouseId(warehouse.id); setEditingWarehouseCode(warehouse.code); setEditingWarehouseName(warehouse.name); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit details", "تعديل البيانات")}</button><button type="button" disabled={busy} onClick={() => void toggleWarehouse(warehouse)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{warehouse.isActive ? translate(locale, "Deactivate", "تعطيل") : translate(locale, "Reactivate", "إعادة التفعيل")}</button></div>
            </article>)}</div>
            {editingWarehouseId && <form onSubmit={saveWarehouse} className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-white/60 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-1 text-sm">{translate(locale, "Warehouse code", "رمز المستودع")}<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" className={field} value={editingWarehouseCode} onChange={(e) => setEditingWarehouseCode(e.target.value)} /></label>
              <label className="grid gap-1 text-sm">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={120} className={field} value={editingWarehouseName} onChange={(e) => setEditingWarehouseName(e.target.value)} /></label>
              <div className="flex items-end gap-2"><button disabled={busy} className={button}>{translate(locale, "Save changes", "حفظ التغييرات")}</button><button type="button" disabled={busy} onClick={() => setEditingWarehouseId("")} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">{translate(locale, "Cancel", "إلغاء")}</button></div>
            </form>}
          </section>
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)] lg:col-span-2"><h2 className="text-lg font-semibold">{translate(locale, "Stock adjustment", "تعديل المخزون")}</h2><form onSubmit={adjustStock} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">{translate(locale, "Warehouse", "المستودع")}<select required className={field} value={adjustWarehouseId} onChange={(e) => setAdjustWarehouseId(e.target.value)}>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Product variant", "متغير المنتج")}<select required className={field} value={adjustVariantId} onChange={(e) => setAdjustVariantId(e.target.value)}><option value="">{translate(locale, "Select variant", "اختر متغيرًا")}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.productName} · {variant.sku}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Quantity change (+/-)", "تغيير الكمية (+/−)")}<input required type="number" step="1" min="-1000000" max="1000000" className={field} value={quantityDelta} onChange={(e) => setQuantityDelta(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Note", "ملاحظة")}<input maxLength={500} className={field} value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} /></label><button disabled={busy || !adjustWarehouseId || !adjustVariantId || !Number.isInteger(Number(quantityDelta)) || Number(quantityDelta) === 0} className={button + " sm:col-span-2"}>{translate(locale, "Record stock adjustment", "تسجيل تعديل المخزون")}</button></form></section>
        </div>
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{translate(locale, "Physical stock count", "الجرد الفعلي للمخزون")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Snapshot a warehouse, enter the physically counted sellable quantity for every SKU, then reconcile differences into the stock ledger.", "أنشئ لقطة للمستودع، وأدخل الكمية القابلة للبيع التي تم عدّها فعلياً لكل صنف، ثم اعتمد الفروقات في سجل المخزون.")}</p></div><span className="rounded-full bg-white/70 px-3 py-1 text-xs">{stockCounts.length} {translate(locale, "count sessions", "جلسات جرد")}</span></div>
          <form onSubmit={openStockCount} className="mt-4 flex flex-wrap items-end gap-3"><label className="grid min-w-0 w-full flex-1 gap-1 sm:min-w-[220px] text-sm">{translate(locale, "Warehouse to count", "المستودع المراد جرده")}<select required className={field} value={countWarehouseId} onChange={(e) => setCountWarehouseId(e.target.value)}><option value="">{translate(locale, "Select warehouse", "اختر المستودع")}</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><button disabled={busy || !countWarehouseId} className={button}>{translate(locale, "Open count session", "فتح جلسة جرد")}</button></form>
          {stockCounts.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{stockCounts.map((count) => <button type="button" key={count.id} disabled={busy} onClick={() => void selectStockCount(count.id)} className={activeStockCount?.id === count.id ? "rounded-xl border border-[var(--accent)] bg-white px-3 py-2 text-xs font-semibold shadow-sm" : "rounded-xl border border-[var(--border)] bg-white/60 px-3 py-2 text-xs"}>{count.warehouse.name} · {new Date(count.openedAt).toLocaleDateString(locale === "ar" ? "ar" : "en-GB")} · {count.status === "COMPLETED" ? translate(locale, "Completed", "مكتمل") : count.status === "CANCELLED" ? translate(locale, "Cancelled", "ملغى") : translate(locale, "In progress", "قيد التنفيذ")}</button>)}</div>}
          {activeStockCount && <div className="mt-5 rounded-2xl border border-white/80 bg-white/65 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{activeStockCount.warehouse.name}</h3><p className="text-xs text-[var(--muted)]">{translate(locale, "Snapshot", "تاريخ فتح الجرد")}: {new Date(activeStockCount.openedAt).toLocaleString(locale === "ar" ? "ar" : "en-GB")} · {activeStockCount.lines.length} {translate(locale, "items", "أصناف")}</p></div><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs">{activeStockCount.status === "COMPLETED" ? translate(locale, "Completed", "مكتمل") : activeStockCount.status === "CANCELLED" ? translate(locale, "Cancelled", "ملغى") : translate(locale, "In progress", "قيد التنفيذ")}</span></div>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-2">{translate(locale, "Product / SKU", "المنتج / SKU")}</th><th>{translate(locale, "Expected", "المسجل")}</th><th>{translate(locale, "Reserved", "محجوز")}</th><th>{translate(locale, "Quarantined", "قيد الحجر")}</th><th>{translate(locale, "Physical count", "الكمية الفعلية")}</th><th>{translate(locale, "Variance", "الفرق")}</th><th>{translate(locale, "Action", "الإجراء")}</th></tr></thead><tbody>{activeStockCount.lines.map((line) => { const raw = countDrafts[line.id] ?? (line.countedQuantity === null ? "" : String(line.countedQuantity)); const qty = raw.trim() ? Number(raw) : null; const variance = qty === null || !Number.isSafeInteger(qty) ? null : qty - line.expectedQuantity; return <tr key={line.id} className="border-b border-[var(--border)]"><td className="py-3 font-medium">{line.inventory.variant.product.name}<span className="block text-xs text-[var(--muted)]">{line.inventory.variant.sku}</span></td><td>{line.expectedQuantity}</td><td>{line.inventory.quantityReserved}</td><td>{line.inventory.quantityQuarantined}</td><td><input aria-label={translate(locale, "Physically counted quantity", "الكمية المعدودة فعلياً")} disabled={busy || activeStockCount.status !== "IN_PROGRESS"} type="number" min="0" step="1" className="w-24 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5" value={raw} onChange={(e) => setCountDrafts((current) => ({ ...current, [line.id]: e.target.value }))} /></td><td className={variance === null ? "" : variance < 0 ? "font-semibold text-rose-700" : variance > 0 ? "font-semibold text-emerald-700" : ""}>{variance === null ? "—" : variance > 0 ? "+" + variance : variance}</td><td>{activeStockCount.status === "IN_PROGRESS" && <button type="button" disabled={busy || qty === null || !Number.isSafeInteger(qty) || qty < 0} onClick={() => void saveCountLine(line)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold">{translate(locale, "Save", "حفظ")}</button>}</td></tr>; })}</tbody></table></div>
            {activeStockCount.status === "IN_PROGRESS" && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">{activeStockCount.lines.filter((line) => line.countedQuantity !== null).length} / {activeStockCount.lines.length} {translate(locale, "items counted and saved", "أصناف تم عدّها وحفظها")}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || activeStockCount.lines.some((line) => line.countedQuantity === null)} onClick={() => void completeCount()} className={button}>{translate(locale, "Reconcile and complete count", "اعتماد التسوية وإنهاء الجرد")}</button><button type="button" disabled={busy} onClick={() => void cancelCount()} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">{translate(locale, "Cancel session", "إلغاء الجلسة")}</button></div></div>}
          </div>}
        </section>
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]"><h2 className="text-lg font-semibold">{translate(locale, "Current stock", "المخزون الحالي")}</h2><label className="mt-4 block max-w-xl text-xs font-medium">{translate(locale, "Search inventory", "البحث في المخزون")}<input value={search} onChange={event=>setSearch(event.target.value)} maxLength={120} placeholder={translate(locale, "Product, SKU, warehouse or code", "المنتج أو SKU أو المستودع أو الرمز")} className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"/></label>{!inventory.length ? <p className="mt-4 text-sm text-[var(--muted)]">{search ? translate(locale, "No inventory records match this search.", "لا توجد سجلات مخزون تطابق هذا البحث.") : translate(locale, "No inventory records in this store yet.", "لا توجد سجلات مخزون في هذا المتجر بعد.")}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3">{translate(locale, "Product / SKU", "المنتج / SKU")}</th><th>{translate(locale, "Warehouse", "المستودع")}</th><th>{translate(locale, "Sellable on hand", "المخزون القابل للبيع")}</th><th>{translate(locale, "Quarantined", "قيد الحجر")}</th><th>{translate(locale, "Reserved", "محجوز")}</th><th>{translate(locale, "Available", "المتاح")}</th></tr></thead><tbody>{inventory.map((row) => <tr key={row.id} className="border-b border-[var(--border)]"><td className="py-3 font-medium">{row.variant.product.name}<span className="block text-xs text-[var(--muted)]">{row.variant.sku}</span></td><td>{row.warehouse.name}</td><td>{row.quantityOnHand}</td><td>{row.quantityQuarantined}</td><td>{row.quantityReserved}</td><td><span className={row.isLowStock ? "font-semibold text-amber-700" : ""}>{row.quantityAvailable}</span></td></tr>)}</tbody></table></div>}
          {inventoryCursor && <div className="mt-4 text-center"><button type="button" onClick={() => void loadMoreInventory()} disabled={loadingInventoryMore || busy} className={button}>{loadingInventoryMore ? translate(locale, "Loading more inventory…", "جارٍ تحميل المزيد من المخزون…") : translate(locale, "Load more inventory", "تحميل المزيد من المخزون")}</button></div>}</section>
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]">
          <h2 className="text-lg font-semibold">{translate(locale, "Return inspection & quarantine", "فحص المرتجعات والحجر")}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Release inspected units back to sellable stock, or record disposal. Only physically quarantined quantities can be processed.", "حرر الوحدات التي اجتازت الفحص إلى المخزون القابل للبيع أو سجل إتلافها. لا يمكن معالجة إلا الكميات الموجودة فعلياً في الحجر.")}</p>
          <form onSubmit={decideQuarantine} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-sm">{translate(locale, "Warehouse", "المستودع")}<select required className={field} value={quarantineWarehouseId} onChange={(e) => setQuarantineWarehouseId(e.target.value)}><option value="">{translate(locale, "Select warehouse", "اختر المستودع")}</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Product variant", "متغير المنتج")}<select required className={field} value={quarantineVariantId} onChange={(e) => setQuarantineVariantId(e.target.value)}><option value="">{translate(locale, "Select variant", "اختر متغيراً")}</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.productName} · {v.sku}</option>)}</select></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Quantity", "الكمية")}<input required type="number" min="1" max="1000000" step="1" className={field} value={quarantineQuantity} onChange={(e) => setQuarantineQuantity(e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Decision", "القرار")}<select className={field} value={quarantineDecision} onChange={(e) => setQuarantineDecision(e.target.value as "RELEASE" | "DISPOSE")}><option value="RELEASE">{translate(locale, "Release to sellable", "تحرير للبيع")}</option><option value="DISPOSE">{translate(locale, "Dispose", "إتلاف")}</option></select></label>
            <label className="grid gap-1 text-sm">{translate(locale, "Inspection note", "ملاحظة الفحص")}<input maxLength={500} className={field} value={quarantineNote} onChange={(e) => setQuarantineNote(e.target.value)} /></label>
            <button disabled={busy || !quarantineWarehouseId || !quarantineVariantId || !Number.isInteger(Number(quarantineQuantity)) || Number(quarantineQuantity) < 1} className={button + " sm:col-span-2 lg:col-span-5"}>{quarantineDecision === "RELEASE" ? translate(locale, "Release inspected stock", "تحرير المخزون المفحوص") : translate(locale, "Record disposal", "تسجيل الإتلاف")}</button>
          </form>
        </section>
        <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{translate(locale, "Stock movement ledger", "سجل حركات المخزون")}</h2><span className="text-xs text-[var(--muted)]">{translate(locale, "Movement ledger · paginated", "سجل الحركات · صفحات متتابعة")}</span></div>
          {!movements.length ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No stock movements recorded yet.", "لا توجد حركات مخزون مسجلة بعد.")}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3">{translate(locale, "Date", "التاريخ")}</th><th>{translate(locale, "Product / SKU", "المنتج / SKU")}</th><th>{translate(locale, "Warehouse", "المستودع")}</th><th>{translate(locale, "Movement", "الحركة")}</th><th>{translate(locale, "On-hand Δ", "تغير الكمية")}</th><th>{translate(locale, "Quarantine Δ", "تغير الحجر")}</th><th>{translate(locale, "Reference / note", "المرجع / الملاحظة")}</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-b border-[var(--border)]"><td className="py-3 whitespace-nowrap">{new Date(movement.createdAt).toLocaleString(locale === "ar" ? "ar" : "en-GB")}</td><td className="font-medium">{movement.inventory.variant.product.name}<span className="block text-xs text-[var(--muted)]">{movement.inventory.variant.sku}</span></td><td>{movement.inventory.warehouse.name}</td><td>{movementLabel(movement.type)}</td><td className={movement.quantityDelta < 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</td><td>{movement.quarantinedDelta > 0 ? "+" : ""}{movement.quarantinedDelta}</td><td className="max-w-[220px] truncate">{movement.referenceType ? movement.referenceType + " · " + (movement.referenceId ?? "") : movement.note ?? "—"}</td></tr>)}</tbody></table></div>}
          {movementCursor && <div className="mt-4 text-center"><button type="button" onClick={() => void loadOlderMovements()} disabled={loadingMovements || busy} className={button}>{loadingMovements ? translate(locale, "Loading older movements…", "جارٍ تحميل الحركات الأقدم…") : translate(locale, "Load older movements", "تحميل الحركات الأقدم")}</button></div>}
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]"><h2 className="text-lg font-semibold">{translate(locale, "Create stock transfer", "إنشاء نقل مخزون")}</h2><form onSubmit={createTransfer} className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">{translate(locale, "Source warehouse", "المستودع المصدر")}<select required className={field} value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Destination warehouse", "المستودع الوجهة")}<select required className={field} value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>{warehouses.filter((w) => w.id !== sourceWarehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Variant", "المتغير")}<select required className={field} value={transferVariantId} onChange={(e) => setTransferVariantId(e.target.value)}><option value="">{translate(locale, "Select variant", "اختر متغيرًا")}</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.productName} · {v.sku}</option>)}</select></label><label className="grid gap-1 text-sm">{translate(locale, "Quantity", "الكمية")}<input required type="number" min="1" max="1000000" step="1" className={field} value={transferQuantity} onChange={(e) => setTransferQuantity(e.target.value)} /></label><label className="grid gap-1 text-sm">{translate(locale, "Reference (optional)", "مرجع (اختياري)")}<input maxLength={100} className={field} value={transferReference} onChange={(e) => setTransferReference(e.target.value)} /></label><button disabled={busy || warehouses.length < 2 || !transferVariantId || !sourceWarehouseId || !destinationWarehouseId || sourceWarehouseId === destinationWarehouseId || !Number.isInteger(Number(transferQuantity)) || Number(transferQuantity) < 1} className={button}>{translate(locale, "Create transfer draft", "إنشاء مسودة نقل")}</button></form></section>
          <section className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-4 sm:p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]"><h2 className="text-lg font-semibold">{translate(locale, "Transfer history", "سجل النقل")}</h2>{!transfers.length ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No transfers recorded yet.", "لا توجد عمليات نقل مسجلة بعد.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">{transfers.map((transfer) => <article key={transfer.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{transfer.reference || transfer.id.slice(0, 10)}</p><span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs">{transferStatusLabel(transfer.status)}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{transfer.sourceWarehouse.name} → {transfer.destinationWarehouse.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{transfer.items.map((item) => item.variant.sku + " × " + item.quantity).join(", ")}</p><div className="mt-3 flex gap-2">{transfer.status === "DRAFT" && <button disabled={busy} onClick={() => processTransfer(transfer.id, "ship")} className={button}>{translate(locale, "Ship", "شحن")}</button>}{transfer.status === "SHIPPED" && <button disabled={busy} onClick={() => processTransfer(transfer.id, "receive")} className={button}>{translate(locale, "Receive", "استلام")}</button>}</div></article>)}</div>}</section>
        </div>
      </div>}
    </div>
  </main>;
}
