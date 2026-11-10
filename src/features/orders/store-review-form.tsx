"use client";

import { FormEvent, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function StoreReviewForm({ storeId, vendorOrderId, storeName }: { storeId: string; vendorOrderId: string; storeName: string }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorOrderId, rating: Number(rating), title, body, mediaUrls: mediaUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean) })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Store review could not be submitted.", "تعذّر إرسال تقييم المتجر."));
      setMessage(t("Your store review is awaiting moderation.", "تقييم متجرك قيد انتظار المراجعة.")); setTitle(""); setBody(""); setMediaUrls("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Store review could not be submitted.", "تعذّر إرسال تقييم المتجر.")); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 border-t border-[var(--border)] pt-4">
    <h3 className="font-semibold text-[var(--color-forest-950)]">{t("Review", "قيّم")} {storeName}</h3>
    {message ? <p role="status" className="mt-2 text-sm text-[var(--color-forest-800)]">{message}</p> : <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      {error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}
      <label className="text-sm font-medium">{t("Rating", "التقييم")}<select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} {t("out of 5", "من ٥")}</option>)}</select></label>
      <label className="text-sm font-medium">{t("Title", "العنوان")}<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
      <label className="text-sm font-medium sm:col-span-2">{t("Your experience", "تجربتك")}<textarea required minLength={20} maxLength={4000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /></label>
      <label className="text-sm font-medium sm:col-span-2">{t("Image URLs (optional)", "روابط الصور (اختياري)")}<textarea value={mediaUrls} onChange={(event) => setMediaUrls(event.target.value)} maxLength={11000} rows={3} placeholder={t("One HTTPS image URL per line", "رابط صورة HTTPS واحد في كل سطر")} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" /><span className="text-xs font-normal text-[var(--muted)]">{t("Up to 5 public HTTPS JPG, PNG, GIF, WebP or AVIF URLs. This attaches existing images; it does not upload files.", "يمكن إضافة ما يصل إلى ٥ روابط صور عامة بصيغ JPG أو PNG أو GIF أو WebP أو AVIF عبر HTTPS. تُرفق هذه الصور الموجودة ولا يتم رفع ملفات.")}</span></label>
      <button disabled={busy} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? t("Submitting…", "جارٍ الإرسال…") : t("Submit store review", "إرسال تقييم المتجر")}</button>
    </form>}
  </div>;
}
