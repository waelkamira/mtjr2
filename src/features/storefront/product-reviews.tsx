"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AuthReturnLink from "@/components/auth-return-link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Review = {
  id: string; rating: number; title: string; body: string; author: string; createdAt: string; verifiedPurchase: true;
  media: Array<{ id: string; url: string; altText: string | null; position: number }>;
};
type ReviewableItem = { id: string; productName: string; sku: string; quantity: number; orderNumber: string; purchasedAt: string };
const reportReasons = ["INAPPROPRIATE", "SPAM", "FAKE", "CONFLICT_OF_INTEREST", "PERSONAL_INFORMATION", "OTHER"] as const;

export default function ProductReviews({ productId }: { productId: string }) {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [items, setItems] = useState<Review[]>([]);
  const [summary, setSummary] = useState({ averageRating: 0, reviewCount: 0 });
  const [eligible, setEligible] = useState<ReviewableItem[]>([]);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [rating, setRating] = useState("5");
  const [orderItemId, setOrderItemId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [reportId, setReportId] = useState("");
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]>("INAPPROPRIATE");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async () => {
    const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews?limit=20`, { cache: "no-store" });
    const data = await response.json() as { items?: Review[]; summary?: { averageRating: number; reviewCount: number }; error?: string };
    if (!response.ok) throw new Error(data.error || t("Reviews could not be loaded.", "تعذّر تحميل التقييمات."));
    setItems(data.items || []);
    setSummary(data.summary || { averageRating: 0, reviewCount: 0 });
  }, [productId, t]);

  const loadEligible = useCallback(async () => {
    const response = await fetch(`/api/account/reviewable-items?productId=${encodeURIComponent(productId)}`, { cache: "no-store" });
    if (response.status === 401) { setNeedsSignIn(true); setEligible([]); return; }
    const data = await response.json() as { items?: ReviewableItem[]; error?: string };
    if (!response.ok) throw new Error(data.error || t("Eligible purchases could not be loaded.", "تعذّر تحميل عمليات الشراء المؤهلة."));
    setNeedsSignIn(false);
    setEligible(data.items || []);
    setOrderItemId((current) => current || data.items?.[0]?.id || "");
  }, [productId, t]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => Promise.all([loadReviews(), loadEligible()]))
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t("Reviews are unavailable.", "التقييمات غير متاحة.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadReviews, loadEligible, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderItemId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, rating: Number(rating), title, body, mediaUrls: mediaUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean) })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Review could not be submitted.", "تعذّر إرسال التقييم."));
      setMessage(t("Your review was submitted and is awaiting moderation.", "أُرسل تقييمك وهو بانتظار المراجعة."));
      setTitle(""); setBody(""); setMediaUrls("");
      await Promise.all([loadReviews(), loadEligible()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Review could not be submitted.", "تعذّر إرسال التقييم.")); }
    finally { setBusy(false); }
  }

  async function reportReview(reviewId: string) {
    setReportBusy(true); setError(""); setReportMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews/${encodeURIComponent(reviewId)}/reports`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Review report could not be submitted.", "تعذّر إرسال بلاغ التقييم."));
      setReportMessage(t("Thank you. The review was sent to moderation.", "شكرًا لك. أُرسل التقييم إلى فريق الإشراف."));
      setReportId(""); setReportDetails("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Review report could not be submitted.", "تعذّر إرسال بلاغ التقييم."));
    } finally { setReportBusy(false); }
  }

  return <section className="mx-auto max-w-6xl px-5 pb-16">
    <div className="border-t border-[var(--border)] pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{t("Customer feedback", "آراء العملاء")}</p><h2 className="mt-2 text-2xl font-semibold text-[var(--color-forest-950)]">{t("Product reviews", "تقييمات المنتج")}</h2></div>
        <div className="text-right"><p className="text-2xl font-semibold text-[var(--color-forest-950)]">{summary.reviewCount ? summary.averageRating.toFixed(1) : "—"} <span className="text-[var(--color-copper-600)]">★</span></p><p className="text-xs text-[var(--muted)]">{summary.reviewCount} {t("published reviews", "تقييم منشور")}</p></div>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm text-[var(--color-forest-900)]">{message}</p>}
      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {loading ? <div className="h-36 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.length ? items.map((review) => <article key={review.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-[var(--color-forest-950)]">{review.title}</h3><span aria-label={`${review.rating} ${t("out of 5 stars", "من ٥ نجوم")}`} className="text-sm tracking-wider text-[var(--color-copper-600)]">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{review.body}</p>
            {review.media.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{review.media.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label={t("Open customer review image", "فتح صورة تقييم العميل")}><img src={image.url} alt={image.altText || t("Customer review image", "صورة تقييم العميل")} loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 rounded-xl border border-[var(--border)] object-cover" /></a>)}</div>}
            <p className="mt-4 text-xs text-[var(--muted)]">{review.author} · {t("Verified purchase", "عملية شراء موثّقة")} · {new Date(review.createdAt).toLocaleDateString(locale)}</p>
            <button type="button" onClick={() => { setReportId(reportId === review.id ? "" : review.id); setReportMessage(""); }} className="mt-3 text-xs font-medium text-[var(--color-forest-900)] underline">{t("Report review", "الإبلاغ عن التقييم")}</button>
            {reportId === review.id && <div className="mt-3 grid gap-2 rounded-xl bg-[var(--color-ivory-100)] p-3">
              <label className="text-xs font-medium">{t("Reason", "السبب")}<select value={reportReason} onChange={(event) => setReportReason(event.target.value as (typeof reportReasons)[number])} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-2 py-2">{reportReasons.map((reason) => <option key={reason} value={reason}>{t(reason.replaceAll("_", " ").toLowerCase(), ({ INAPPROPRIATE: "غير لائق", SPAM: "رسائل مزعجة", FAKE: "مزيّف", CONFLICT_OF_INTEREST: "تضارب مصالح", PERSONAL_INFORMATION: "معلومات شخصية", OTHER: "أخرى" } as Record<string, string>)[reason])}</option>)}</select></label>
              <label className="text-xs font-medium">{t("Details (optional)", "تفاصيل (اختياري)")}<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={2} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-2 py-2" /></label>
              <button type="button" disabled={reportBusy} onClick={() => void reportReview(review.id)} className="justify-self-start rounded-lg bg-[var(--color-forest-900)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{reportBusy ? t("Sending…", "جارٍ الإرسال…") : t("Send report", "إرسال البلاغ")}</button>
            </div>}
          </article>) : !error ? <div className="rounded-2xl border border-dashed border-[var(--border)] p-7 text-center text-sm text-[var(--muted)]">{t("No published reviews yet. Be the first verified buyer to share feedback.", "لا توجد تقييمات منشورة بعد. كن أول مشترٍ موثّق يشارك رأيه.")}</div> : null}
          {reportMessage && <p role="status" className="text-sm text-[var(--color-forest-900)]">{reportMessage}</p>}
        </div>
        <aside className="h-fit rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="font-semibold text-[var(--color-forest-950)]">{t("Write a review", "اكتب تقييمًا")}</h3>
          {needsSignIn ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("Sign in with the account used for your purchase. Reviews are available after delivery.", "سجّل الدخول بالحساب الذي استخدمته للشراء. تتاح التقييمات بعد التوصيل.")}</p> :
            eligible.length ? <form onSubmit={submit} className="mt-4 space-y-3">
              <label className="block text-sm font-medium">{t("Delivered purchase", "عملية شراء تم توصيلها")}<select required value={orderItemId} onChange={(event) => setOrderItemId(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">{eligible.map((item) => <option key={item.id} value={item.id}>{item.orderNumber} · {item.sku} · {t("Qty", "الكمية")} {item.quantity}</option>)}</select></label>
              <label className="block text-sm font-medium">{t("Rating", "التقييم")}<select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} {t("out of 5", "من ٥")}</option>)}</select></label>
              <label className="block text-sm font-medium">{t("Title", "العنوان")}<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
              <label className="block text-sm font-medium">{t("Your experience", "تجربتك")}<textarea required minLength={20} maxLength={4000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
              <label className="block text-sm font-medium">{t("Image URLs (optional)", "روابط الصور (اختياري)")}<textarea value={mediaUrls} onChange={(event) => setMediaUrls(event.target.value)} maxLength={11000} rows={3} placeholder={t("One HTTPS image URL per line", "رابط صورة HTTPS واحد في كل سطر")} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /><span className="mt-1 block text-xs text-[var(--muted)]">{t("Up to 5 public HTTPS JPG, PNG, GIF, WebP or AVIF URLs. This attaches existing images; it does not upload files.", "يمكن إضافة ما يصل إلى ٥ روابط صور عامة بصيغ JPG أو PNG أو GIF أو WebP أو AVIF عبر HTTPS. تُرفق هذه الصور الموجودة ولا يتم رفع ملفات.")}</span></label>
              <button disabled={busy || !orderItemId} className="w-full rounded-xl bg-[var(--color-forest-900)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Submitting…", "جارٍ الإرسال…") : t("Submit review", "إرسال التقييم")}</button>
            </form> : <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("Only customers with a delivered purchase can review this product. Reviews are limited to one per customer and product.", "يمكن فقط للعملاء الذين تسلّموا مشترياتهم تقييم هذا المنتج. يُسمح بتقييم واحد لكل عميل ولكل منتج.")}</p>}
          {needsSignIn && <AuthReturnLink href="/login" className="mt-4 inline-flex rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white">{t("Sign in", "تسجيل الدخول")}</AuthReturnLink>}
        </aside>
      </div>
    </div>
  </section>;
}
