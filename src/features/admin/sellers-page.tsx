"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";

type StoreRow = { id: string; name: string; slug: string; status: string; createdAt: string };
type SellerRow = {
  id: string; status: string; legalName: string | null; displayName: string | null; createdAt: string;
  contactName: string | null; contactEmail: string | null; phoneNumber: string | null; residence: string | null;
  businessType: string | null; sellingCategories: string | null; intendedProducts: string | null; description: string | null;
  facebookUrl: string | null; youtubeUrl: string | null; twitterUrl: string | null; latitude: number | null; longitude: number | null;
  hasIdentityDocument: boolean;
  registrationCountryCode: string | null; registrationNumber: string | null; registrationAuthority: string | null;
  registrationDate: string | null; registeredAddress: string | null; taxIdentificationNumber: string | null; businessWebsite: string | null;
  hasBusinessRegistrationDocument: boolean; hasTaxCertificateDocument: boolean; hasProofOfAddressDocument: boolean;
  owner: { id: string; email: string; displayName: string | null; status: string };
  stores: StoreRow[]; storeCount: number;
};
type Result = { items: SellerRow[]; page: number; pageCount: number; total: number };
const statuses = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"];

export default function AdminSellersPage() {
  const { locale } = useLocale();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/sellers?${params}`, { cache: "no-store" });
    const result = await response.json() as Result & { error?: string };
    if (!response.ok) throw new Error(result.error || translate(locale, "Seller list unavailable.", "قائمة البائعين غير متاحة."));
    setData(result);
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/sellers?${params}`, { cache: "no-store" });
        const result = await response.json() as Result & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Seller list unavailable.", "قائمة البائعين غير متاحة."));
        if (active) { setData(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Seller list unavailable.", "قائمة البائعين غير متاحة."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, page, query, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draftQuery.trim();
    if (query === q && page === 1) return;
    setLoading(true);
    setPage(1);
    setQuery(q);
  }

  async function review(seller: SellerRow, decision: "APPROVE" | "REJECT") {
    const reason = reasons[seller.id]?.trim() || "";
    if (decision === "REJECT" && reason.length < 5) { setError(translate(locale, "Enter a rejection reason of at least five characters.", "أدخل سببًا للرفض لا يقل عن خمسة أحرف.")); return; }
    if (!window.confirm(`${translate(locale, decision === "APPROVE" ? "Approve" : "Reject", decision === "APPROVE" ? "الموافقة على" : "رفض")} ${translate(locale, "seller", "البائع")} ${seller.displayName || seller.legalName || seller.id}?`)) return;
    setBusy(seller.id); setError("");
    try {
      const response = await fetch(`/api/admin/sellers/${encodeURIComponent(seller.id)}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason || undefined })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || translate(locale, "Seller review failed.", "تعذرت مراجعة البائع."));
      setReasons((current) => ({ ...current, [seller.id]: "" }));
      await load();
      toast.success(translate(locale, decision === "APPROVE" ? "Seller approved." : "Seller rejected.", decision === "APPROVE" ? "تمت الموافقة على البائع." : "تم رفض البائع."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Seller review failed.", "تعذرت مراجعة البائع."); setError(message); toast.error(message); }
    finally { setBusy(""); }
  }

  async function changeStore(store: StoreRow, nextStatus: "ACTIVE" | "SUSPENDED") {
    const reason = reasons[store.id]?.trim() || "";
    if (reason.length < 5) { setError(translate(locale, "Enter a store status reason of at least five characters.", "أدخل سببًا لتغيير حالة المتجر لا يقل عن خمسة أحرف.")); return; }
    if (!window.confirm(`${translate(locale, nextStatus === "SUSPENDED" ? "Suspend" : "Reactivate", nextStatus === "SUSPENDED" ? "تعليق" : "إعادة تفعيل")} ${translate(locale, "store", "المتجر")} ${store.name}?`)) return;
    setBusy(store.id); setError("");
    try {
      const response = await fetch(`/api/admin/stores/${encodeURIComponent(store.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || translate(locale, "Store status update failed.", "تعذر تحديث حالة المتجر."));
      setReasons((current) => ({ ...current, [store.id]: "" }));
      await load();
      toast.success(translate(locale, nextStatus === "SUSPENDED" ? "Store suspended." : "Store reactivated.", nextStatus === "SUSPENDED" ? "تم تعليق المتجر." : "تمت إعادة تفعيل المتجر."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Store status update failed.", "تعذر تحديث حالة المتجر."); setError(message); toast.error(message); }
    finally { setBusy(""); }
  }

  return <main aria-busy={loading || Boolean(busy)} className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{translate(locale, "Seller operations", "عمليات البائعين")}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-6"><div><h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{translate(locale, "Sellers and stores", "البائعون والمتاجر")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Review seller applications and administer active store availability.", "راجع طلبات البائعين وأدِر إتاحة المتاجر النشطة.")}</p></div><p className="text-sm text-[var(--muted)]">{data?.total ?? 0} {translate(locale, "sellers", "بائع")}</p></div>
    <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:grid-cols-[1fr_220px_auto]">
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search seller, owner, email or ID", "ابحث عن البائع أو المالك أو البريد الإلكتروني أو المعرّف")}<input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-black placeholder:text-neutral-500 focus:border-[#FF8C1C] focus:outline-none focus:ring-2 focus:ring-[#FF8C1C]/20" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Seller status", "حالة البائع")}<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100"><option value="">{translate(locale, "All statuses", "جميع الحالات")}</option>{statuses.map((item) => <option key={item} value={item}>{translateStatus(locale, item)}</option>)}</select></label>
      <button disabled={loading} className="self-end rounded-xl bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F0780B] disabled:opacity-60">{translate(locale, "Search", "بحث")}</button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && !data ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" /> : <div aria-busy={loading || Boolean(busy)} className="mt-5 space-y-4">{data?.items.map((seller) => <article key={seller.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{translate(locale, "Seller", "البائع")} {seller.id}</p><h2 className="mt-1 text-lg font-semibold">{seller.displayName || seller.legalName || translate(locale, "Unnamed seller", "بائع بلا اسم")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{seller.legalName || translate(locale, "No legal name", "لا يوجد اسم قانوني")} · {translate(locale, "Applied", "تاريخ التقديم")} {new Date(seller.createdAt).toLocaleDateString(locale === "ar" ? "ar-SY" : "en-GB")}</p></div><StatusBadge locale={locale} status={seller.status} className="h-fit" /></div>
      <div className="mt-4 border-t border-[var(--border)] pt-4 text-sm"><p><Link href={`/admin/users/${encodeURIComponent(seller.owner.id)}`} className="font-semibold underline">{seller.owner.displayName || seller.owner.email}</Link> · {seller.owner.email} · {translate(locale, "account", "الحساب")} <StatusBadge locale={locale} status={seller.owner.status} /></p></div>
      <div className="mt-4 grid gap-3 rounded-xl bg-[var(--surface-soft)] p-4 text-sm sm:grid-cols-2">
        <p><strong>{translate(locale, "Contact person", "الشخص المسؤول")}:</strong> {seller.contactName || "—"}</p>
        <p><strong>{translate(locale, "Contact email", "بريد التواصل")}:</strong> {seller.contactEmail || "—"}</p>
        <p><strong>{translate(locale, "Phone", "الهاتف")}:</strong> {seller.phoneNumber || "—"}</p>
        <div className="flex items-center gap-2"><strong>{translate(locale, "Identity document", "وثيقة الهوية")}:</strong>{seller.hasIdentityDocument ? <a href={`/api/admin/sellers/${encodeURIComponent(seller.id)}/identity-document`} target="_blank" rel="noreferrer" className="font-semibold text-[#c65d0a] underline decoration-orange-200 underline-offset-4 hover:text-[#9a4300]">{translate(locale, "View secure document", "عرض الوثيقة بشكل آمن")}</a> : <span className="text-[var(--muted)]">{translate(locale, "Not provided", "لم تُرفق")}</span>}</div>
        <p><strong>{translate(locale, "Business type", "نوع النشاط")}:</strong> {seller.businessType || "—"}</p>
        <p className="sm:col-span-2"><strong>{translate(locale, "Business address", "عنوان النشاط")}:</strong> {seller.residence || "—"}</p>
        <p><strong>{translate(locale, "Registration country", "بلد التسجيل")}:</strong> {seller.registrationCountryCode || "—"}</p>
        <p><strong>{translate(locale, "Registration number", "رقم السجل التجاري")}:</strong> {seller.registrationNumber || "—"}</p>
        <p><strong>{translate(locale, "Registration authority", "جهة التسجيل")}:</strong> {seller.registrationAuthority || "—"}</p>
        <p><strong>{translate(locale, "Registration date", "تاريخ التسجيل")}:</strong> {seller.registrationDate ? new Date(seller.registrationDate).toLocaleDateString(locale === "ar" ? "ar" : "en") : "—"}</p>
        <p className="sm:col-span-2"><strong>{translate(locale, "Registered address", "العنوان المسجل")}:</strong> {seller.registeredAddress || "—"}</p>
        <p><strong>{translate(locale, "Tax ID", "الرقم الضريبي")}:</strong> {seller.taxIdentificationNumber || "—"}</p>
        <p className="sm:col-span-2"><strong>{translate(locale, "Business website", "الموقع الإلكتروني للنشاط")}:</strong> {seller.businessWebsite ? <a href={seller.businessWebsite} target="_blank" rel="noreferrer" className="underline">{seller.businessWebsite}</a> : "—"}</p>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          {seller.hasBusinessRegistrationDocument && <a href={`/api/admin/sellers/${encodeURIComponent(seller.id)}/documents/businessRegistration`} target="_blank" rel="noreferrer" className="font-semibold text-[#c65d0a] underline decoration-orange-200 underline-offset-4 hover:text-[#9a4300]">{translate(locale, "Business registration certificate", "شهادة السجل التجاري")}</a>}
          {seller.hasTaxCertificateDocument && <a href={`/api/admin/sellers/${encodeURIComponent(seller.id)}/documents/taxCertificate`} target="_blank" rel="noreferrer" className="font-semibold text-[#c65d0a] underline decoration-orange-200 underline-offset-4 hover:text-[#9a4300]">{translate(locale, "Tax certificate", "الشهادة الضريبية")}</a>}
          {seller.hasProofOfAddressDocument && <a href={`/api/admin/sellers/${encodeURIComponent(seller.id)}/documents/proofOfAddress`} target="_blank" rel="noreferrer" className="font-semibold text-[#c65d0a] underline decoration-orange-200 underline-offset-4 hover:text-[#9a4300]">{translate(locale, "Proof of address", "إثبات العنوان")}</a>}
        </div>
        <p className="sm:col-span-2"><strong>{translate(locale, "Product categories", "فئات المنتجات")}:</strong> {seller.sellingCategories || "—"}</p>
        <p className="whitespace-pre-wrap sm:col-span-2"><strong>{translate(locale, "Products and sales plan", "المنتجات وخطة البيع")}:</strong> {seller.intendedProducts || "—"}</p>
        {seller.description && <p className="whitespace-pre-wrap sm:col-span-2"><strong>{translate(locale, "Business description", "نبذة عن النشاط")}:</strong> {seller.description}</p>}
        {(seller.latitude !== null && seller.longitude !== null) && <p className="sm:col-span-2"><strong>{translate(locale, "Map coordinates", "إحداثيات الموقع")}:</strong> <a className="underline" href={`https://www.openstreetmap.org/?mlat=${seller.latitude}&mlon=${seller.longitude}#map=15/${seller.latitude}/${seller.longitude}`} target="_blank" rel="noreferrer">{seller.latitude.toFixed(5)}, {seller.longitude.toFixed(5)}</a></p>}
        <div className="flex flex-wrap gap-3 sm:col-span-2">{seller.facebookUrl && <a href={seller.facebookUrl} target="_blank" rel="noreferrer" className="underline">Facebook</a>}{seller.youtubeUrl && <a href={seller.youtubeUrl} target="_blank" rel="noreferrer" className="underline">YouTube</a>}{seller.twitterUrl && <a href={seller.twitterUrl} target="_blank" rel="noreferrer" className="underline">X</a>}</div>
      </div>
      {seller.status === "PENDING" && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Review reason (required for rejection)", "سبب المراجعة (مطلوب للرفض)")}<input value={reasons[seller.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [seller.id]: event.target.value }))} maxLength={500} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-black placeholder:text-neutral-500 focus:border-[#FF8C1C] focus:outline-none focus:ring-2 focus:ring-[#FF8C1C]/20" /></label><button disabled={busy === seller.id} onClick={() => void review(seller, "APPROVE")} className="self-end rounded-lg bg-[#FF8C1C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F0780B] disabled:opacity-50">{translate(locale, "Approve", "موافقة")}</button><button disabled={busy === seller.id} onClick={() => void review(seller, "REJECT")} className="self-end rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">{translate(locale, "Reject", "رفض")}</button></div>}
      <div className="mt-5 border-t border-[var(--border)] pt-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{translate(locale, "Stores", "المتاجر")}</h3><span className="text-xs text-[var(--muted)]">{seller.storeCount} {translate(locale, "total · showing latest", "إجماليًا · عرض الأحدث")} {seller.stores.length}</span></div>{seller.stores.length ? seller.stores.map((store) => <div key={store.id} className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{store.name}</p><p className="text-xs text-[var(--muted)]">/{store.slug} · <StatusBadge locale={locale} status={store.status} /></p></div>{store.status === "ACTIVE" || store.status === "SUSPENDED" ? <div className="flex flex-wrap gap-2"><input aria-label={`${translate(locale, "Reason for", "سبب تغيير حالة")} ${store.name}`} placeholder={translate(locale, "Reason (5+ chars)", "السبب (5 أحرف فأكثر)")} value={reasons[store.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [store.id]: event.target.value }))} maxLength={500} className="w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-black placeholder:text-neutral-500 focus:border-[#FF8C1C] focus:outline-none focus:ring-2 focus:ring-[#FF8C1C]/20" /><button disabled={busy === store.id} onClick={() => void changeStore(store, store.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold disabled:opacity-50">{store.status === "ACTIVE" ? translate(locale, "Suspend", "تعليق") : translate(locale, "Reactivate", "إعادة تفعيل")}</button></div> : null}</div></div>) : <p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "No stores created.", "لم يتم إنشاء متاجر.")}</p>}</div>
    </article>)}{!data?.items.length && !error && <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No sellers match the selected filters.", "لا يوجد بائعون يطابقون عوامل التصفية المحددة.")}</div>}</div>}
    {data && data.pageCount > 1 && <div className="mt-4 flex items-center justify-between"><button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{translate(locale, "Page", "صفحة")} {data.page} {translate(locale, "of", "من")} {data.pageCount}</span><button disabled={page >= data.pageCount || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{translate(locale, "Next", "التالي")}</button></div>}
  </div></main>;
}
