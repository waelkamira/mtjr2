"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toast } from "sonner";

type ProductReview = {
  id: string; rating: number; title: string; body: string; status: string; createdAt: string;
  product: { id: string; name: string; slug: string; media: Array<{ url: string }> };
  appeals: Array<{ id: string; status: string }>;
};
type StoreReview = {
  id: string; rating: number; title: string; body: string; status: string; sellerResponse: string | null; createdAt: string;
  store: { id: string; name: string; slug: string }; vendorOrder: { order: { orderNumber: string } };
  appeals: Array<{ id: string; status: string }>;
};

export default function AccountReviewsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [productItems, setProductItems] = useState<ProductReview[]>([]);
  const [storeItems, setStoreItems] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  const [busyAppealId, setBusyAppealId] = useState("");
  const [appealMessage, setAppealMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/account/reviews", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { productItems?: ProductReview[]; storeItems?: StoreReview[]; error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Your reviews could not be loaded.", "تعذّر تحميل تقييماتك."));
      if (active) { setProductItems(data.productItems || []); setStoreItems(data.storeItems || []); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Your reviews could not be loaded.", "تعذّر تحميل تقييماتك.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);
  const hasReviews = productItems.length > 0 || storeItems.length > 0;
  async function submitAppeal(kind: "PRODUCT" | "STORE", reviewId: string) {
    const key = `${kind}:${reviewId}`;
    setBusyAppealId(key); setError(""); setAppealMessage("");
    try {
      const response = await fetch(`/api/account/reviews/${encodeURIComponent(reviewId)}/appeal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, reason: appealReasons[key] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Review appeal could not be submitted.", "تعذّر إرسال الاعتراض على التقييم."));
      const refreshed = await fetch("/api/account/reviews", { cache: "no-store" });
      if (!refreshed.ok) throw new Error(t("Appeal was submitted, but your review history could not be refreshed.", "تم إرسال الاعتراض، لكن تعذّر تحديث سجل تقييماتك."));
      const reviews = await refreshed.json() as { productItems?: ProductReview[]; storeItems?: StoreReview[] };
      setProductItems(reviews.productItems || []); setStoreItems(reviews.storeItems || []);
      setAppealMessage(t("Your appeal was sent to moderation.", "تم إرسال اعتراضك إلى فريق الإشراف."));
      toast.success(t("Appeal submitted for moderation.", "تم إرسال الاعتراض للمراجعة."));
      setAppealReasons((current) => ({ ...current, [key]: "" }));
    } catch (cause) { const message = cause instanceof Error ? cause.message : t("Review appeal could not be submitted.", "تعذّر إرسال الاعتراض على التقييم."); setError(message); toast.error(message); }
    finally { setBusyAppealId(""); }
  }
  function appealControl(kind: "PRODUCT" | "STORE", id: string, status: string, appeals: Array<{ id: string; status: string }>) {
    const key = `${kind}:${id}`;
    if (appeals.length) return <p className="mt-3 text-xs text-[var(--muted)]">{t("Appeal status:", "حالة الاعتراض:")} <StatusBadge locale={locale} status={appeals[0].status} /></p>;
    if (status !== "REJECTED" && status !== "HIDDEN") return null;
    return <form onSubmit={(event) => { event.preventDefault(); void submitAppeal(kind, id); }} className="mt-3 space-y-2">
      <label className="block text-xs font-medium">{t("Appeal this decision", "اعترض على هذا القرار")}<textarea required minLength={20} maxLength={2000} rows={3} value={appealReasons[key] || ""} onChange={(event) => setAppealReasons((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2" /></label>
      <button disabled={busyAppealId === key} className="rounded-lg bg-[var(--color-ink-800)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyAppealId === key ? t("Sending…", "جارٍ الإرسال…") : t("Submit appeal", "إرسال الاعتراض")}</button>
    </form>;
  }
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-5"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/account/orders" className="text-sm">{t("My orders", "طلباتي")}</Link></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Your activity", "نشاطك")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("My reviews", "تقييماتي")}</h1>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {appealMessage && <p role="status" className="mt-5 rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--color-ink-800)]">{appealMessage}</p>}
      {loading ? <div aria-label={t("Loading reviews", "جارٍ تحميل التقييمات")} className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : hasReviews ? <div className="mt-6 space-y-8">
        {productItems.length > 0 && <section><h2 className="mb-3 text-lg font-semibold">{t("Product reviews", "تقييمات المنتجات")}</h2><div className="space-y-3">{productItems.map((item) => <article key={item.id} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-5">{item.product.media[0]?.url && <img src={item.product.media[0].url} alt="" className="h-20 w-20 rounded-xl object-cover" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="font-semibold text-[var(--color-ink-800)] underline">{item.product.name}</Link><span className="text-xs font-semibold"><StatusBadge locale={locale} status={item.status} /></span></div><p className="mt-1 text-sm text-[var(--color-lavender-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><h3 className="mt-2 text-sm font-semibold">{item.title}</h3><p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{item.body}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleDateString(locale==="ar"?"ar":"en")}</p>{appealControl("PRODUCT", item.id, item.status, item.appeals)}</div></article>)}</div></section>}
        {storeItems.length > 0 && <section><h2 className="mb-3 text-lg font-semibold">{t("Store reviews", "تقييمات المتاجر")}</h2><div className="space-y-3">{storeItems.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.store.name}</h3><span className="text-xs font-semibold"><StatusBadge locale={locale} status={item.status} /></span></div><p className="mt-1 text-xs text-[var(--muted)]">{t("Order","الطلب")} {item.vendorOrder.order.orderNumber}</p><p className="mt-2 text-sm text-[var(--color-lavender-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><h4 className="mt-2 text-sm font-semibold">{item.title}</h4><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.body}</p>{item.sellerResponse && <div className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs font-semibold">{t("Seller response", "رد البائع")}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.sellerResponse}</p></div>}{appealControl("STORE", item.id, item.status, item.appeals)}</article>)}</div></section>}
      </div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{t("You have not submitted any reviews yet.", "لم ترسل أي تقييمات بعد.")}</div> : null}
    </div>
  </main>;
}
