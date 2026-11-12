"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  store: { id: string; name: string; seller: { ownerId: string; displayName: string | null; owner: { email: string } } };
  orderItemCount: number;
};

export default function AdminCatalogProductsManagementPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [storeId, setStoreId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (query.trim()) params.set("q", query.trim());
        if (status) params.set("status", status);
        if (storeId.trim()) params.set("storeId", storeId.trim());
        if (ownerId.trim()) params.set("ownerId", ownerId.trim());
        const response = await fetch(`/api/admin/products/manage?${params}`, { cache: "no-store" });
        const data = await response.json() as { items?: AdminProduct[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Product management list unavailable.");
        if (active) {
          setItems(data.items || []);
          setSelected([]);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Product management list unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [query, status, storeId, ownerId, revision]);

  async function archive(event: FormEvent<HTMLFormElement>, scope: { productIds?: string[]; storeId?: string; ownerId?: string }) {
    event.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError(translate(locale, "Enter an administrative reason of at least five characters.", "أدخل سببًا إداريًا لا يقل عن خمسة أحرف."));
      return;
    }
    const target = scope.productIds ? `${scope.productIds.length} ${translate(locale, "selected product(s)", "منتج محدد")}`
      : scope.storeId ? `${translate(locale, "all eligible products in store", "جميع المنتجات المؤهلة في المتجر")} ${scope.storeId}`
        : `${translate(locale, "all eligible products owned by user", "جميع المنتجات المؤهلة المملوكة للمستخدم")} ${scope.ownerId}`;
    if (!window.confirm(`${translate(locale, "Archive", "أرشفة")} ${target}? ${translate(locale, "Products with order history will remain in historical records.", "ستظل المنتجات التي لها سجل طلبات محفوظة في السجلات السابقة.")}`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/products/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scope, reason })
      });
      const data = await response.json() as { archived?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Product archive failed.");
      setMessage(`${data.archived ?? 0} ${translate(locale, "product(s) archived. The action was written to the audit log.", "منتج تمت أرشفته. تم تسجيل الإجراء في سجل التدقيق.")}`);
      toast.success(translate(locale, "Product archive completed.", "اكتملت أرشفة المنتجات."), { description: `${data.archived ?? 0}` });
      setReason("");
      setRevision((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Product archive failed.", "تعذرت أرشفة المنتجات."); setError(message); toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const toggleProduct = (id: string) => setSelected((current) =>
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
  );

  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Catalog operations", "عمليات الكتالوج")}</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Product management", "إدارة المنتجات")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Archive selected products or scope the action to one store or store owner. Historical order items are preserved.", "أرشف المنتجات المحددة أو احصر الإجراء في متجر واحد أو مالك متجر. يتم الاحتفاظ بعناصر الطلبات السابقة.")}</p></div><p className="text-sm text-[var(--muted)]">{items.length} {translate(locale, "shown · up to 100", "معروض · بحد أقصى 100")}</p></div>
    <section className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 md:grid-cols-4">
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search products, stores, sellers", "البحث عن منتجات أو متاجر أو بائعين")}<input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Status", "الحالة")}<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "All non-archived", "جميع المنتجات غير المؤرشفة")}</option><option value="DRAFT">{translate(locale, "Draft", "مسودة")}</option><option value="ACTIVE">{translate(locale, "Active", "نشط")}</option><option value="ARCHIVED">{translate(locale, "Archived", "مؤرشف")}</option></select></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Store ID", "معرّف المتجر")}<input value={storeId} onChange={(event) => setStoreId(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Store owner user ID", "معرّف مستخدم مالك المتجر")}<input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {selected.length > 100 && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{translate(locale, "Select no more than 100 products per action.", "حدد 100 منتج كحد أقصى لكل إجراء.")}</p>}
    <form onSubmit={(event) => void archive(event, { productIds: selected })} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-white p-4">
      <label className="min-w-64 flex-1 text-xs font-medium text-[var(--muted)]">{translate(locale, "Reason for selected-product archive", "سبب أرشفة المنتجات المحددة")}<input required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <button disabled={busy || selected.length === 0 || selected.length > 100} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? translate(locale, "Archiving…", "جارٍ الأرشفة…") : `${translate(locale, "Archive selected", "أرشفة المحدد")} (${selected.length})`}</button>
    </form>
    <div className="mt-5 space-y-3">
      {loading ? <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.map((item) => <article key={item.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-[var(--border)] bg-white p-4">
        <input aria-label={`${translate(locale, "Select", "تحديد")} ${item.name}`} type="checkbox" checked={selected.includes(item.id)} disabled={item.status === "ARCHIVED"} onChange={() => toggleProduct(item.id)} className="mt-1 size-4 accent-[var(--color-forest-900)]" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.name}</h2><StatusBadge locale={locale} status={item.status} /><StatusBadge locale={locale} status={item.approvalStatus} /></div><p className="mt-1 break-all text-xs text-[var(--muted)]">{item.id} · {item.slug}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.store.name} · {translate(locale, "owner", "المالك")} {item.store.seller.displayName || item.store.seller.owner.email} ({item.store.seller.ownerId}) · {translate(locale, "store", "المتجر")} {item.store.id}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.orderItemCount} historical order item(s) · updated {new Date(item.updatedAt).toLocaleString()}</p></div>
      </article>)}
      {!loading && !error && !items.length && <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No products match these filters.", "لا توجد منتجات تطابق عوامل التصفية هذه.")}</div>}
    </div>
    {(storeId.trim() || ownerId.trim()) && <form onSubmit={(event) => void archive(event, storeId.trim() ? { storeId: storeId.trim() } : { ownerId: ownerId.trim() })} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="w-full text-sm font-semibold text-amber-950">{translate(locale, "Scope archive: this archives every non-archived product for the current", "تحديد نطاق الأرشفة: سيؤرشف هذا كل منتج غير مؤرشف مرتبط بـ")} {storeId.trim() ? translate(locale, "store ID", "معرّف المتجر") : translate(locale, "owner user ID", "معرّف مستخدم المالك")}, {translate(locale, "up to 500 products per action.", "بحد أقصى 500 منتج لكل إجراء.")}</p>
      <label className="min-w-64 flex-1 text-xs font-medium text-amber-900">{translate(locale, "Required reason", "السبب مطلوب")}<input required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <button disabled={busy || (!storeId.trim() && !ownerId.trim())} className="rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? translate(locale, "Archiving…", "جارٍ الأرشفة…") : translate(locale, "Archive scoped products", "أرشفة المنتجات ضمن النطاق")}</button>
    </form>}
  </div></main>;
}
