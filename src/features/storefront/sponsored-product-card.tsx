"use client";

import { formatMinorUnits } from "@/lib/money";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, translate } from "@/lib/locale";

type Product = {
  id: string; slug: string; name: string; description: string | null;
  brand: { name: string } | null; store: { id: string; name: string; slug: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ prices: Array<{ amountMinor: string | bigint; currencyCode: string; currency: { minorUnit: number } }> }>;
};
function eventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
async function send(token: string, type: "IMPRESSION" | "CLICK") {
  try { return await fetch("/api/advertising/events", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, type, eventId: eventId() }), keepalive: true
  }); } catch { return null; }
}
export default function SponsoredProductCard({ product, token, locale }: { product: Product; token: string; locale: Locale }) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    const node = root.current;
    if (!node || sent.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5) && !sent.current) {
        sent.current = true; void send(token, "IMPRESSION"); observer.disconnect();
      }
    }, { threshold: [0.5] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [token]);
  const image = product.media.find((item) => item.isPrimary) ?? product.media[0];
  const price = product.variants.flatMap((variant) => variant.prices)[0];
  const priceLabel = price
    ? formatMinorUnits(price.amountMinor, price.currencyCode, price.currency.minorUnit, locale)
    : translate(locale, "Price unavailable", "السعر غير متاح");
  return <article ref={root} data-testid="sponsored-product" data-ad-token={token} className="clay-surface group relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-copper-300)] bg-[var(--surface)] shadow-sm">
    <Link href={`/products/${encodeURIComponent(product.slug)}`} onClick={async (event) => { event.preventDefault(); await send(token, "CLICK"); router.push(`/products/${encodeURIComponent(product.slug)}`); }} className="block">
      <span className="absolute z-10 m-3 rounded-full bg-[var(--color-copper-700)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{translate(locale, "Sponsored", "إعلان ممول")}</span>
      {image ? <img src={image.url} alt={image.altText ?? product.name} className="aspect-square w-full bg-[var(--surface-soft)] object-cover" /> : <div className="aspect-square bg-[var(--surface-soft)]" />}
      <div className="p-4"><h2 className="line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h2><p className="mt-3 text-xl font-extrabold">{priceLabel}</p><p className="mt-2 text-xs text-[var(--muted)]">{translate(locale, "Sold by", "يُباع بواسطة")} {product.store.name}</p></div>
    </Link>
  </article>;
}
