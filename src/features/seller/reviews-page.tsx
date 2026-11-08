"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

type Review = {
  id: string; rating: number; title: string; body: string; status: string; sellerResponse: string | null;
  sellerRespondedAt: string | null; createdAt: string; store: { id: string; name: string; slug: string };
  user: { displayName: string | null }; vendorOrder: { order: { orderNumber: string } };
  media: Array<{ id: string; url: string; altText: string | null }>;
};

export default function SellerReviewsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<Review[]>([]);
  const [responses, setResponses] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/seller/reviews", { cache: "no-store" });
    const data = await response.json() as { items?: Review[]; error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Store reviews could not be loaded.", "تعذر تحميل تقييمات المتجر."));
    setItems(data.items || []);
  }, [locale]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Store reviews could not be loaded.", "تعذر تحميل تقييمات المتجر.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, locale]);
  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    label: String(rating) + " stars",
    value: items.filter((review) => review.rating === rating).length,
    color: ["bg-emerald-500", "bg-lime-500", "bg-amber-500", "bg-orange-500", "bg-rose-500"][5 - rating]
  }));
  const responseCounts = [
    { label: "Responded to", value: items.filter((review) => Boolean(review.sellerResponse)).length, color: "bg-emerald-500" },
    { label: "Awaiting response", value: items.filter((review) => !review.sellerResponse).length, color: "bg-amber-500" }
  ];
  async function respond(event: FormEvent<HTMLFormElement>, review: Review) {
    event.preventDefault(); setBusyId(review.id); setError("");
    try {
      const response = await fetch(`/api/seller/reviews/${encodeURIComponent(review.id)}/response`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: responses[review.id] || review.sellerResponse || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Seller response could not be saved.", "تعذر حفظ رد البائع."));
      await load();
      toast.success(translate(locale, "Your response was saved.", "تم حفظ ردك."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Seller response could not be saved.", "تعذر حفظ رد البائع."); setError(message); toast.error(message); }
    finally { setBusyId(""); }
  }
  return <main className="min-h-screen bg-transparent">
    <div className="mx-auto max-w-[1440px] px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{translate(locale, "Store reputation", "سمعة المتجر")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Customer reviews", "تقييمات العملاء")}</h1>
      {!loading && !error && items.length > 0 && <section aria-label="Review analytics" className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricBarChart title="Customer rating distribution" description="Ratings from reviews returned for stores you manage." rows={ratingCounts} />
        <MetricBarChart title="Seller response coverage" description="Tracks public replies on the currently loaded reviews." rows={responseCounts} />
      </section>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div className="mt-6 space-y-4">{items.map((review) => <article key={review.id} className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-6 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.05)]"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{review.store.name} · {translate(locale, "Order", "الطلب")} {review.vendorOrder.order.orderNumber}</p><h2 className="mt-1 font-semibold">{review.title}</h2></div><div className="text-right"><p className="text-[var(--color-lavender-600)]">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</p><p className="text-xs text-[var(--muted)]">{translate(locale, review.status, review.status === "PUBLISHED" ? "منشور" : review.status === "PENDING" ? "قيد المراجعة" : review.status === "REJECTED" ? "مرفوض" : review.status)}</p></div></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{review.body}</p>{review.media.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{review.media.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label={translate(locale, "Open customer review image", "فتح صورة تقييم العميل")}><img src={image.url} alt={image.altText || translate(locale, "Customer review image", "صورة تقييم العميل")} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}<p className="mt-3 text-xs text-[var(--muted)]">{translate(locale, "By", "بواسطة")} {review.user.displayName || translate(locale, "Verified buyer", "مشتري موثّق")} · {new Date(review.createdAt).toLocaleDateString()}</p>
        {review.status === "PUBLISHED" && <form onSubmit={(event) => void respond(event,review)} className="mt-5 border-t border-[var(--border)] pt-4"><label className="block text-sm font-medium">{translate(locale, "Your public response", "ردك العلني")}<textarea rows={3} maxLength={2000} minLength={3} value={responses[review.id] ?? review.sellerResponse ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [review.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label><button disabled={busyId === review.id} className="mt-3 rounded-xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === review.id ? translate(locale, "Saving…", "جارٍ الحفظ…") : review.sellerResponse ? translate(locale, "Update response", "تحديث الرد") : translate(locale, "Post response", "نشر الرد")}</button></form>}
      </article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No store reviews yet.", "لا توجد تقييمات للمتجر بعد.")}</div> : null}
    </div>
  </main>;
}
