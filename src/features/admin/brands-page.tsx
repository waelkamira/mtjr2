"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";

type Brand = {
  id: string; name: string; slug: string; description: string | null;
  logoUrl: string | null; websiteUrl: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"; productCount: number; updatedAt: string;
};
type BrandForm = Omit<Brand, "id" | "productCount" | "updatedAt" | "status"> & { status: "DRAFT" | "ACTIVE" };

function BrandLogo({ name, logoUrl, size = "large" }: { name: string; logoUrl: string | null; size?: "small" | "large" }) {
  return <BrandLogoImage key={logoUrl || "no-logo"} name={name} logoUrl={logoUrl} size={size} />;
}

function BrandLogoImage({ name, logoUrl, size }: { name: string; logoUrl: string | null; size: "small" | "large" }) {
  const [failed, setFailed] = useState(false);
  const dimensions = size === "small" ? "h-12 w-12 rounded-xl" : "h-20 w-20 rounded-2xl";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toLocaleUpperCase();
  if (logoUrl && !failed) return <img src={logoUrl} alt={name + " logo"} onError={() => setFailed(true)} className={`${dimensions} shrink-0 border border-[var(--border)] bg-[var(--surface)] object-contain p-1`} />;
  return <div aria-label={name + " logo placeholder"} className={`${dimensions} grid shrink-0 place-items-center border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-100 font-black text-orange-700 shadow-inner ${size === "small" ? "text-sm" : "text-2xl"}`}>{initials || "?"}</div>;
}

const emptyForm: BrandForm = { name: "", slug: "", description: null, logoUrl: null, websiteUrl: null, status: "DRAFT" };

export default function AdminBrandsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<Brand[]>([]);
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/admin/brands", { cache: "no-store" });
        const data = await response.json() as { items?: Brand[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Brand list unavailable.");
        if (active) { setItems(data.items || []); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Brand list unavailable.");
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [revision]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const needle = searchQuery.trim().toLocaleLowerCase();
    const matchesQuery = !needle || [item.name, item.slug, item.id, item.websiteUrl || ""].some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesQuery && (!statusFilter || item.status === statusFilter);
  }), [items, searchQuery, statusFilter]);

  function reset() { setEditingId(""); setForm(emptyForm); }
  function edit(item: Brand) {
    if (item.status === "ARCHIVED") {
      setError(translate(locale, "Archived brands cannot be edited or reactivated.", "لا يمكن تعديل العلامات المؤرشفة أو إعادة تفعيلها."));
      return;
    }
    setEditingId(item.id);
    setForm({ name: item.name, slug: item.slug, description: item.description, logoUrl: item.logoUrl, websiteUrl: item.websiteUrl, status: item.status });
    setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(editingId ? `/api/admin/brands/${encodeURIComponent(editingId)}` : "/api/admin/brands", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, description: form.description || null, logoUrl: form.logoUrl || null, websiteUrl: form.websiteUrl || null })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Brand save failed.");
      toast.success(translate(locale, editingId ? "Brand updated." : "Brand created.", editingId ? "تم تحديث العلامة التجارية." : "تم إنشاء العلامة التجارية."));
      reset(); setRevision((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Brand save failed.";
      setError(message); toast.error(message);
    } finally { setBusy(false); }
  }
  async function archive(item: Brand) {
    const reason = archiveReason.trim();
    if (reason.length < 5) { setError(translate(locale, "Enter an archive reason of at least five characters.", "أدخل سبباً للأرشفة لا يقل عن خمسة أحرف.")); return; }
    if (!window.confirm(translate(locale, `Archive “${item.name}”? Existing product references will be preserved.`, `هل تريد أرشفة «${item.name}»؟ ستبقى مراجع المنتجات الحالية محفوظة.`))) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/brands/${encodeURIComponent(item.id)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Brand archive failed.");
      toast.success(translate(locale, "Brand archived.", "تمت أرشفة العلامة التجارية."));
      setArchiveReason(""); if (editingId === item.id) reset(); setRevision((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Brand archive failed.";
      setError(message); toast.error(message);
    } finally { setBusy(false); }
  }

  return <main aria-busy={loading || busy} className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-orange-700">{translate(locale, "Catalog operations", "عمليات الكتالوج")}</p>
    <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{translate(locale, "Brand management", "إدارة العلامات التجارية")}</h1>
    <div className="mt-3 flex justify-end"><button type="button" disabled={loading || busy} onClick={() => { setLoading(true); setError(""); setRevision((value) => value + 1); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50">{translate(locale, "Refresh", "تحديث")}</button></div>
    <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">{translate(locale, "Create and maintain brand identities, public visibility and product associations. Only ACTIVE brands appear in the public directory; drafts and archived brands remain visible here for management. Archiving preserves historical product references.", "أنشئ العلامات التجارية وأدر هويتها وظهورها العام وارتباطاتها بالمنتجات. تظهر العلامات النشطة فقط في الدليل العام، بينما تبقى المسودات والعلامات المؤرشفة هنا للإدارة. وتحافظ الأرشفة على مراجع المنتجات التاريخية.")}</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <form onSubmit={(event) => void save(event)} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:grid-cols-2 xl:grid-cols-3">
      <h2 className="text-lg font-semibold md:col-span-2 xl:col-span-3">{editingId ? translate(locale, "Edit brand", "تعديل العلامة") : translate(locale, "Create brand", "إنشاء علامة تجارية")}</h2>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Name", "الاسم")}<input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={180} value={form.slug} onChange={(e) => setForm((v) => ({ ...v, slug: e.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Status", "الحالة")}<select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as BrandForm["status"] }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="DRAFT">{translateStatus(locale, "DRAFT")}</option><option value="ACTIVE">{translateStatus(locale, "ACTIVE")}</option></select></label>
      <div className="flex items-center gap-4 rounded-xl border border-orange-100 bg-orange-50/40 p-3"><BrandLogo name={form.name || translate(locale, "Brand preview", "معاينة العلامة")} logoUrl={form.logoUrl} /><label className="min-w-0 flex-1 text-xs font-medium text-[var(--muted)]">{translate(locale, "Logo URL", "رابط الشعار")}<input type="url" maxLength={2048} value={form.logoUrl || ""} onChange={(e) => setForm((v) => ({ ...v, logoUrl: e.target.value || null }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100 placeholder:text-stone-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" /><span className="mt-1 block text-[11px]">{translate(locale, "Preview updates as the image URL changes. A monogram appears if the image cannot load.", "تتحدث المعاينة عند تغيير الرابط، وتظهر الأحرف الأولى إذا تعذر تحميل الصورة.")}</span></label></div>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Website URL", "الموقع الرسمي")}<input type="url" maxLength={2048} value={form.websiteUrl || ""} onChange={(e) => setForm((v) => ({ ...v, websiteUrl: e.target.value || null }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-medium text-[var(--muted)] md:col-span-2 xl:col-span-3">{translate(locale, "Description", "الوصف")}<textarea rows={3} maxLength={2000} value={form.description || ""} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value || null }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
      <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3"><button disabled={busy} className="rounded-xl bg-[#FF8C1C] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-500/20 transition hover:bg-[#F57C00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, editingId ? "Save changes" : "Create brand", editingId ? "حفظ التعديلات" : "إنشاء العلامة")}</button>{editingId && <button type="button" disabled={busy} onClick={reset} className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm">{translate(locale, "Cancel", "إلغاء")}</button>}</div>
    </form>
    <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] p-5"><div><h2 className="text-lg font-semibold">{translate(locale, "Brands", "العلامات التجارية")}</h2><span className="text-xs text-[var(--muted)]">{items.length} {translate(locale, "records", "سجلات")} · {visibleItems.length} {translate(locale, "shown", "معروض")}</span></div><div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(220px,1fr)_160px]"><label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search brands", "البحث في العلامات التجارية")}<input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label><label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Status", "الحالة")}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "All statuses", "كل الحالات")}</option><option value="DRAFT">{translateStatus(locale, "DRAFT")}</option><option value="ACTIVE">{translateStatus(locale, "ACTIVE")}</option><option value="ARCHIVED">{translateStatus(locale, "ARCHIVED")}</option></select></label></div></div>
      {loading ? <p role="status" className="p-6 text-sm text-[var(--muted)]">{translate(locale, "Loading brands…", "جارٍ تحميل العلامات…")}</p> : visibleItems.length === 0 ? <p className="p-6 text-sm text-[var(--muted)]">{items.length ? translate(locale, "No brands match these filters.", "لا توجد علامات تجارية تطابق عوامل التصفية.") : translate(locale, "No brands found.", "لا توجد علامات تجارية.")}</p> : <div className="divide-y divide-[var(--border)]">{visibleItems.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex min-w-0 items-center gap-3"><BrandLogo name={item.name} logoUrl={item.logoUrl} size="small" /><div className="min-w-0"><h3 className="font-semibold text-[var(--foreground)]">{item.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{item.slug} · <StatusBadge locale={locale} status={item.status} /> · {item.productCount} {translate(locale, "products", "منتج")} · {translate(locale, "Updated", "آخر تحديث")} {new Date(item.updatedAt).toLocaleDateString(locale === "ar" ? "ar-SY" : "en-GB")}</p>{item.websiteUrl && <a href={item.websiteUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-orange-700">{item.websiteUrl}</a>}</div></div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={busy || item.status === "ARCHIVED"} onClick={() => edit(item)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{translate(locale, "Edit", "تعديل")}</button>{item.status !== "ARCHIVED" && <button type="button" disabled={busy} onClick={() => void archive(item)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{translate(locale, "Archive", "أرشفة")}</button>}</div></article>)}</div>}
      <div className="border-t border-[var(--border)] p-4"><label className="block text-xs text-[var(--muted)]">{translate(locale, "Archive reason", "سبب الأرشفة")}<input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" placeholder={translate(locale, "Required before archiving", "مطلوب قبل الأرشفة")} /></label></div>
    </section>
  </div></main>;
}
