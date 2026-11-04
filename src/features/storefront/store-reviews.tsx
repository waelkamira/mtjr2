"use client";

import { useEffect, useState } from "react";

type StoreReview = {
  id: string; rating: number; title: string; body: string; author: string;
  sellerResponse: string | null; sellerRespondedAt: string | null; createdAt: string;
  media: Array<{ id: string; url: string; altText: string | null }>;
};
const reportReasons = ["INAPPROPRIATE", "SPAM", "FAKE", "CONFLICT_OF_INTEREST", "PERSONAL_INFORMATION", "OTHER"] as const;

export default function StoreReviews({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [items, setItems] = useState<StoreReview[]>([]);
  const [summary, setSummary] = useState({ averageRating: 0, reviewCount: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reportId, setReportId] = useState("");
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]>("INAPPROPRIATE");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/stores/${encodeURIComponent(storeId)}/reviews?limit=5`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { items?: StoreReview[]; summary?: { averageRating: number; reviewCount: number } };
        if (!response.ok) throw new Error("Store reviews unavailable.");
        if (active) { setItems(data.items || []); setSummary(data.summary || { averageRating: 0, reviewCount: 0 }); }
      }).catch((cause) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Store reviews are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId]);
  async function reportReview(reviewId: string) {
    setReportBusy(true); setReportError(""); setReportMessage("");
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/reviews/${encodeURIComponent(reviewId)}/reports`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Review report could not be submitted.");
      setReportMessage("Thank you. The review was sent to moderation."); setReportId(""); setReportDetails("");
    } catch (cause) { setReportError(cause instanceof Error ? cause.message : "Review report could not be submitted."); }
    finally { setReportBusy(false); }
  }
  return <section className="mx-auto max-w-6xl px-5 pb-12">
    <div className="border-t border-[var(--border)] pt-9"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Seller reputation</p><h2 className="mt-2 text-xl font-semibold text-[var(--color-forest-950)]">{storeName} reviews</h2></div><p className="text-sm text-[var(--muted)]">{loadError ? "Ratings unavailable" : summary.reviewCount ? `${summary.averageRating.toFixed(1)} / 5 · ${summary.reviewCount} reviews` : "No published reviews"}</p></div>
      {reportError && <p role="alert" className="mt-4 text-sm text-red-700">{reportError}</p>}
      {reportMessage && <p role="status" className="mt-4 text-sm text-[var(--color-forest-900)]">{reportMessage}</p>}
      {loadError && <p role="alert" className="mt-4 text-sm text-red-700">{loadError}</p>}
      {loading ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-5"><div className="flex justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-sm text-[var(--color-copper-600)]">{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</span></div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>{item.media.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.media.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label="Open customer review image"><img src={image.url} alt={image.altText || "Customer review image"} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}<p className="mt-3 text-xs text-[var(--muted)]">{item.author} · Verified purchase · {new Date(item.createdAt).toLocaleDateString()}</p>{item.sellerResponse && <div className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-3"><p className="text-xs font-semibold text-[var(--color-forest-900)]">Seller response</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.sellerResponse}</p></div>}<button type="button" onClick={() => { setReportId(reportId === item.id ? "" : item.id); setReportError(""); }} className="mt-3 text-xs font-medium text-[var(--color-forest-900)] underline">Report review</button>{reportId === item.id && <div className="mt-3 grid gap-2 rounded-xl bg-[var(--color-ivory-100)] p-3"><label className="text-xs font-medium">Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value as (typeof reportReasons)[number])} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-2 py-2">{reportReasons.map((reason) => <option key={reason} value={reason}>{reason.replaceAll("_", " ").toLowerCase()}</option>)}</select></label><label className="text-xs font-medium">Details (optional)<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={2} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-2 py-2" /></label><button type="button" disabled={reportBusy} onClick={() => void reportReview(item.id)} className="justify-self-start rounded-lg bg-[var(--color-forest-900)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{reportBusy ? "Sending…" : "Send report"}</button></div>}</article>)}</div> : !loadError && <p className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">This store has no published reviews yet.</p>}
    </div>
  </section>;
}
