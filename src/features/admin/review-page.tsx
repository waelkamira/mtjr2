"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type SellerApplication = {
  id: string; legalName: string | null; displayName: string | null; createdAt: string;
  owner: { id: string; email: string; displayName: string | null };
};
type PendingProduct = {
  id: string; name: string; slug: string; description: string | null; createdAt: string;
  store: { id: string; name: string; seller: { id: string; displayName: string | null; legalName: string | null } };
  media: Array<{ url: string; altText: string | null }>;
  variants: Array<{ id: string; sku: string; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string }> }>;
};
type Queues = { sellers: SellerApplication[]; products: PendingProduct[] };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export default function AdminReviewPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [queues, setQueues] = useState<Queues>({ sellers: [], products: [] });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const [sellers, products] = await Promise.all([
      fetch("/api/admin/sellers", { cache: "no-store" }).then((r) => readJson<{ items: SellerApplication[] }>(r)),
      fetch("/api/admin/products", { cache: "no-store" }).then((r) => readJson<{ items: PendingProduct[] }>(r))
    ]);
    setQueues({ sellers: sellers.items, products: products.items });
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : t("Unable to load moderation queues.", "تعذر تحميل قوائم المراجعة."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function reviewSeller(id: string, decision: "APPROVE" | "REJECT") {
    const reason = reasons[id]?.trim() ?? "";
    if (decision === "REJECT" && reason.length < 5) {
      setError(t("Enter a rejection reason of at least five characters.", "أدخل سبباً للرفض لا يقل عن خمسة أحرف."));
      return;
    }
    setBusyId(id); setError(""); setNotice("");
    try {
      await readJson(await fetch(`/api/admin/sellers/${encodeURIComponent(id)}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, ...(decision === "REJECT" ? { reason } : {}) })
      }));
      setNotice(decision === "APPROVE" ? t("Seller application approved.", "تمت الموافقة على طلب البائع.") : t("Seller application rejected.", "تم رفض طلب البائع."));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to review seller application.", "تعذرت مراجعة طلب البائع."));
    } finally { setBusyId(""); }
  }

  async function reviewProduct(id: string, decision: "APPROVE" | "REJECT") {
    const reason = reasons[id]?.trim() ?? "";
    if (decision === "REJECT" && reason.length < 5) {
      setError(t("Enter a rejection reason of at least five characters.", "أدخل سبباً للرفض لا يقل عن خمسة أحرف."));
      return;
    }
    setBusyId(id); setError(""); setNotice("");
    try {
      const endpoint = decision === "APPROVE"
        ? `/api/admin/products/${encodeURIComponent(id)}/approve`
        : `/api/admin/products/${encodeURIComponent(id)}/reject`;
      await readJson(await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        ...(decision === "REJECT" ? { body: JSON.stringify({ reason }) } : {})
      }));
      setNotice(decision === "APPROVE" ? t("Product approved.", "تمت الموافقة على المنتج.") : t("Product rejected.", "تم رفض المنتج."));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to review product.", "تعذرت مراجعة المنتج."));
    } finally { setBusyId(""); }
  }

  const field = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";
  const action = "rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50";
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto min-h-screen w-full max-w-[1600px] bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-[var(--color-orange-600)]">{t("Moderation", "الإشراف")}</p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--color-ink-950)]">{t("Review queue", "قائمة المراجعة")}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("Review seller applications and new product submissions. Every decision is authorized and recorded by the server.", "راجع طلبات البائعين والمنتجات الجديدة. يتم التحقق من صلاحية كل قرار وتسجيله على الخادم.")}</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("Unable to load moderation queues.", "تعذر تحميل قوائم المراجعة."))).finally(() => setLoading(false)); }} disabled={loading || !!busyId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50">{t("Refresh queues", "تحديث القوائم")}</button>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-orange-600)]">{t("Moderation", "الإشراف")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Review queue", "قائمة المراجعة")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("Review seller applications and new product submissions. Every decision is authorized and recorded by the server.", "راجع طلبات البائعين والمنتجات الجديدة. يتم التحقق من صلاحية كل قرار وتسجيله على الخادم.")}</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
      {loading ? <p className="py-12 text-sm text-[var(--muted)]">{t("Loading review queues…", "جارٍ تحميل قوائم المراجعة…")}</p> : <div aria-busy={loading || !!busyId} className="mt-8 grid gap-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{t("Seller applications", "طلبات البائعين")}</h2><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs">{queues.sellers.length} {t("pending", "معلق")}</span></div>
          {!queues.sellers.length ? <p className="mt-4 text-sm text-[var(--muted)]">{t("No pending seller applications.", "لا توجد طلبات بائعين معلقة.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">
            {queues.sellers.map((seller) => <article key={seller.id} className="grid gap-3 py-5 md:grid-cols-[1fr_1fr]">
              <div><h3 className="font-semibold">{seller.displayName || seller.legalName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{seller.legalName}</p><p className="mt-1 text-xs text-[var(--muted)]">{seller.owner.displayName || seller.owner.email} · {seller.owner.email}</p><p className="mt-1 text-xs text-[var(--muted)]">{t("Submitted", "تاريخ التقديم")} {new Date(seller.createdAt).toLocaleDateString(locale === "ar" ? "ar-SY" : "en-GB")}</p></div>
              <div className="grid gap-2"><input className={field} value={reasons[seller.id] ?? ""} onChange={(e) => setReasons((current) => ({ ...current, [seller.id]: e.target.value }))} placeholder={t("Rejection reason (required to reject)", "سبب الرفض (مطلوب للرفض)")} /><div className="flex gap-2"><button disabled={!!busyId} onClick={() => reviewSeller(seller.id, "APPROVE")} className={action + " bg-[#FF8C1C] text-white"}>{t("Approve seller", "الموافقة على البائع")}</button><button disabled={!!busyId} onClick={() => reviewSeller(seller.id, "REJECT")} className={action + " border border-red-200 text-red-700"}>{t("Reject", "رفض")}</button></div></div>
            </article>)}
          </div>}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{t("Product submissions", "المنتجات المقدمة")}</h2><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs">{queues.products.length} {t("pending", "معلق")}</span></div>
          {!queues.products.length ? <p className="mt-4 text-sm text-[var(--muted)]">{t("No products awaiting review.", "لا توجد منتجات بانتظار المراجعة.")}</p> : <div className="mt-4 divide-y divide-[var(--border)]">
            {queues.products.map((product) => <article key={product.id} className="grid gap-4 py-5 md:grid-cols-[1fr_1fr]">
              <div className="flex gap-4">{product.media[0] && <img src={product.media[0].url} alt={product.media[0].altText ?? product.name} className="h-24 w-24 rounded-xl object-cover" />}<div className="min-w-0"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">/{product.slug} · {product.store.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{t("Seller:", "البائع:")} {product.store.seller.displayName || product.store.seller.legalName}</p><p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">{product.description || t("No description provided.", "لم يتم تقديم وصف.")}</p><p className="mt-2 text-xs text-[var(--muted)]">{product.variants.length} {t("active variants", "متغيرات نشطة")} · {t("submitted", "تاريخ التقديم")} {new Date(product.createdAt).toLocaleDateString(locale === "ar" ? "ar-SY" : "en-GB")}</p></div></div>
              <div className="grid gap-2"><input className={field} value={reasons[product.id] ?? ""} onChange={(e) => setReasons((current) => ({ ...current, [product.id]: e.target.value }))} placeholder={t("Rejection reason (required to reject)", "سبب الرفض (مطلوب للرفض)")} /><div className="flex gap-2"><button disabled={!!busyId} onClick={() => reviewProduct(product.id, "APPROVE")} className={action + " bg-[var(--color-ink-800)] text-white"}>{t("Approve product", "الموافقة على المنتج")}</button><button disabled={!!busyId} onClick={() => reviewProduct(product.id, "REJECT")} className={action + " border border-red-200 text-red-700"}>{t("Reject", "رفض")}</button></div></div>
            </article>)}
          </div>}
        </section>
      </div>}
    </div>
  </main>;
}
