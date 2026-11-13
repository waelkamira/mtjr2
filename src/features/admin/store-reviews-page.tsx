"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toast } from "sonner";

type Review = {
  id: string; rating: number; title: string; body: string; createdAt: string;
  store: { id: string; name: string; slug: string };
  user: { id: string; displayName: string | null; email: string };
  vendorOrder: { id: string; order: { orderNumber: string } };
  media: Array<{ id: string; url: string; altText: string | null }>;
};

export default function AdminStoreReviewsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/store-reviews", { cache: "no-store" });
    const data = await response.json() as { items?: Review[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Store review queue could not be loaded.");
    setItems(data.items || []);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Store review queue unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function moderate(review: Review, decision: "PUBLISH" | "REJECT") {
    setBusyId(review.id); setError("");
    try {
      const response = await fetch(`/api/admin/store-reviews/${encodeURIComponent(review.id)}/moderate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Store review could not be moderated.");
      await load();
      toast.success(decision === "PUBLISH" ? "Store review published." : "Store review rejected.");
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Store review could not be moderated."; setError(message); toast.error(message); }
    finally { setBusyId(""); }
  }
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto min-h-screen w-full max-w-[1600px] bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl"><div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--color-orange-600)]">{t("Marketplace quality", "جودة السوق")}</p><h1 className="mt-1 text-3xl font-bold text-[var(--color-ink-950)]">{t("Store review moderation", "الإشراف على تقييمات المتاجر")}</h1><p className="mt-2 text-sm text-[var(--muted)]">{t("Review customer feedback before it appears publicly.", "راجع تقييمات العملاء قبل ظهورها للعامة.")}</p></div><button type="button" onClick={() => { setLoading(true); void load().catch((cause) => setError(cause instanceof Error ? cause.message : t("Store review queue unavailable.", "قائمة تقييمات المتاجر غير متاحة."))).finally(() => setLoading(false)); }} disabled={loading || !!busyId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50">{t("Refresh queue", "تحديث القائمة")}</button></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div aria-busy={loading || !!busyId} className="mt-6 space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-clay-raised"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{t("Store", "المتجر")}</p><h2 className="font-semibold">{item.store.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("Order", "الطلب")} {item.vendorOrder.order.orderNumber}</p></div><div className="text-right"><p className="text-[var(--color-orange-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</p><p className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB")}</p></div></div><h3 className="mt-5 font-semibold">{item.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{item.body}</p>{item.media.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.media.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label={t("Open customer review image", "فتح صورة مراجعة العميل")}><img src={image.url} alt={image.altText || t("Customer review image", "صورة مراجعة العميل")} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}<p className="mt-3 text-xs text-[var(--muted)]">{t("By", "بواسطة")} {item.user.displayName || item.user.email}</p><div className="mt-5 flex flex-wrap gap-3"><button disabled={busyId===item.id} onClick={() => void moderate(item,"PUBLISH")} className="rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{t("Publish", "نشر")}</button><button disabled={busyId===item.id} onClick={() => void moderate(item,"REJECT")} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">{t("Reject", "رفض")}</button></div></article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{t("No store reviews are awaiting moderation.", "لا توجد تقييمات متاجر بانتظار الإشراف.")}</div> : null}
    </div>
  </main>;
}
