"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  sortOrder: number;
  productCount: number;
  childCount: number;
};
type CategoryForm = Omit<Category, "id" | "productCount" | "childCount" | "status"> & { status: "DRAFT" | "ACTIVE" };
const emptyForm: CategoryForm = { parentId: null, slug: "", name: "", description: null, imageUrl: null, status: "DRAFT", sortOrder: 0 };

export default function AdminCategoriesPage({ canManageCatalog }: { canManageCatalog: boolean }) {
  const { locale } = useLocale();
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/admin/categories", { cache: "no-store" });
        const data = await response.json() as { items?: Category[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Category list unavailable.");
        if (active) { setItems(data.items || []); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Category list unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, revision]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const needle = searchQuery.trim().toLocaleLowerCase();
    const matchesQuery = !needle || [item.name, item.slug, item.id].some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesQuery && (!statusFilter || item.status === statusFilter);
  }), [items, searchQuery, statusFilter]);

  function edit(category: Category) {
    if (category.status === "ARCHIVED") {
      setError(translate(locale, "Archived categories cannot be edited or reactivated.", "لا يمكن تعديل الفئات المؤرشفة أو إعادة تفعيلها."));
      return;
    }
    setEditingId(category.id);
    setForm({
      parentId: category.parentId,
      slug: category.slug,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      status: category.status,
      sortOrder: category.sortOrder
    });
    setError(""); setMessage("");
  }

  function reset() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/admin/categories/${encodeURIComponent(editingId)}` : "/api/admin/categories", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, parentId: form.parentId || null, description: form.description || null, imageUrl: form.imageUrl || null, sortOrder: Number(form.sortOrder) })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Category save failed.");
      setMessage(editingId ? translate(locale, "Category updated.", "تم تحديث الفئة.") : translate(locale, "Category created.", "تم إنشاء الفئة."));
      toast.success(editingId ? translate(locale, "Category updated.", "تم تحديث الفئة.") : translate(locale, "Category created.", "تم إنشاء الفئة."));
      reset();
      setRevision((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Category save failed.", "تعذر حفظ الفئة."); setError(message); toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function archive(category: Category) {
    const reason = archiveReason.trim();
    if (reason.length < 5) { setError(translate(locale, "Enter an archive reason of at least five characters.", "أدخل سببًا للأرشفة لا يقل عن خمسة أحرف.")); return; }
    if (!window.confirm(`${translate(locale, "Archive category", "أرشفة الفئة")} “${category.name}”? ${translate(locale, "Existing product and order references will be preserved.", "سيتم الاحتفاظ بمراجع المنتجات والطلبات الحالية.")}`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(category.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Category archive failed.");
      setMessage(`${translate(locale, "Category", "الفئة")} ${category.name} ${translate(locale, "archived. Historical product links were preserved.", "تمت أرشفتها. تم الاحتفاظ بروابط المنتجات السابقة.")}`);
      toast.success(translate(locale, "Category archived.", "تمت أرشفة الفئة."));
      setArchiveReason("");
      if (editingId === category.id) reset();
      setRevision((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Category archive failed.", "تعذرت أرشفة الفئة."); setError(message); toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return <main aria-busy={loading || busy} className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{translate(locale, "Catalog operations", "عمليات الكتالوج")}</p>
    <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{translate(locale, "Category management", "إدارة الفئات")}</h1>
    <div className="mt-3 flex justify-end"><button type="button" disabled={loading || busy} onClick={() => { setLoading(true); setError(""); setRevision((value) => value + 1); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50">{translate(locale, "Refresh", "تحديث")}</button></div>
    <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Manage category hierarchy and visibility. Empty categories remain hidden from storefront discovery. Archiving preserves product and order history.", "أدِر التسلسل الهرمي للفئات وظهورها. تظل الفئات الفارغة مخفية من واجهة المتجر. تحافظ الأرشفة على سجل المنتجات والطلبات.")}</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <form onSubmit={(event) => void save(event)} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:grid-cols-2 xl:grid-cols-3">
      <h2 className="text-lg font-semibold md:col-span-2 xl:col-span-3">{editingId ? translate(locale, "Edit category", "تعديل الفئة") : translate(locale, "Create category", "إنشاء فئة")}</h2>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Slug", "المعرّف")}<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={180} value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Parent category", "الفئة الرئيسية")}<select value={form.parentId || ""} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value || null }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "None (top-level)", "بلا (مستوى أعلى)")}</option>{items.filter((item) => item.id !== editingId && item.status !== "ARCHIVED").map((item) => <option key={item.id} value={item.id}>{item.name} ({item.slug})</option>)}</select></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Status", "الحالة")}<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CategoryForm["status"] }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="DRAFT">{translate(locale, "Draft", "مسودة")}</option><option value="ACTIVE">{translate(locale, "Active", "نشط")}</option></select></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Sort order", "ترتيب العرض")}<input type="number" min={-10000} max={10000} value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Image URL (optional)", "رابط الصورة (اختياري)")}<input type="url" maxLength={2048} value={form.imageUrl || ""} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value || null }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)] md:col-span-2 xl:col-span-3">{translate(locale, "Description", "الوصف")}<textarea maxLength={2000} rows={3} value={form.description || ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value || null }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <div className="flex gap-2 md:col-span-2 xl:col-span-3"><button disabled={busy} className="rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-500/20 transition hover:bg-[#F57C00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : editingId ? translate(locale, "Save category", "حفظ الفئة") : translate(locale, "Create category", "إنشاء فئة")}</button>{editingId && <button type="button" onClick={reset} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">{translate(locale, "Cancel edit", "إلغاء التعديل")}</button>}</div>
    </form>}
    <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{translate(locale, "Categories", "الفئات")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{items.length} {translate(locale, "categories · product links are retained when archived", "فئة · يتم الاحتفاظ بروابط المنتجات عند الأرشفة")}</p></div><div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(220px,1fr)_160px]"><label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search categories", "البحث في الفئات")}<input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label><label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Status", "الحالة")}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "All statuses", "كل الحالات")}</option><option value="DRAFT">{translate(locale, "Draft", "مسودة")}</option><option value="ACTIVE">{translate(locale, "Active", "نشط")}</option><option value="ARCHIVED">{translate(locale, "Archived", "مؤرشف")}</option></select></label></div>{canManageCatalog && <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Archive reason", "سبب الأرشفة")}<input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} minLength={5} maxLength={500} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>}</div>
      {loading ? <div className="mt-4 h-32 animate-pulse rounded-xl bg-[var(--surface-soft)]" /> : <div className="mt-4 divide-y divide-[var(--border)]">{visibleItems.map((category) => <article key={category.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-semibold">{category.name} <span className="text-xs font-normal text-[var(--muted)]">/{category.slug}</span></p><p className="mt-1 text-xs text-[var(--muted)]">{category.parentId ? `${translate(locale, "Parent", "الفئة الرئيسية")} ${items.find((item) => item.id === category.parentId)?.name || category.parentId} · ` : `${translate(locale, "Top-level", "مستوى أعلى")} · `}<StatusBadge locale={locale} status={category.status} /> · {category.productCount} {translate(locale, "product links", "رابط منتج")} · {category.childCount} {translate(locale, "children", "فئات فرعية")}</p></div>{canManageCatalog && <button disabled={busy || category.status === "ARCHIVED"} onClick={() => edit(category)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit", "تعديل")}</button>}{canManageCatalog && category.status !== "ARCHIVED" && <button disabled={busy} onClick={() => void archive(category)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">{translate(locale, "Archive", "أرشفة")}</button>}</article>)}{!visibleItems.length && <p className="py-6 text-center text-sm text-[var(--muted)]">{items.length ? translate(locale, "No categories match these filters.", "لا توجد فئات تطابق عوامل التصفية.") : translate(locale, "No categories have been created.", "لم يتم إنشاء أي فئات.")}</p>}</div>}
    </section>
  </div></main>;
}
