"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthReturnLink from "@/components/auth-return-link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const GUEST_WISHLIST_KEY = "mtjr:guest-wishlist:v1";
function readGuestIds(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(GUEST_WISHLIST_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 100) : [];
  } catch { return []; }
}
type Recommendation = { id: string; slug: string; name: string; image: { url: string; altText: string | null } | null; store: { name: string; slug: string }; reason: string };
type Favorite = {
  id: string; createdAt: string;
  product: {
    id: string; name: string; slug: string; image: { url: string; altText: string | null } | null;
    store: { name: string; slug: string };
  };
};

export default function WishlistPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const load = useCallback(async () => {
    const response = await fetch("/api/favorites", { cache: "no-store" });
    const data = await response.json() as { items?: Favorite[]; error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Wishlist could not be loaded.", "تعذّر تحميل قائمة الأمنيات."));
    setItems(data.items || []);
  }, [locale]);
  useEffect(() => {
    let active = true;
    async function initialize() {
      const guestIds = readGuestIds();
      if (guestIds.length) {
        const merge = await fetch("/api/favorites/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: guestIds })
        });
        if (merge.ok) {
          try { window.localStorage.removeItem(GUEST_WISHLIST_KEY); } catch { /* Retain cache if storage is restricted. */ }
        } else if (merge.status !== 401) {
          const result = await merge.json().catch(() => ({})) as { error?: string };
          throw new Error(result.error || translate(locale, "Guest wishlist could not be merged.", "تعذّر دمج قائمة الأمنيات للزائر."));
        }
      }
      await load();
      const response = await fetch("/api/recommendations", { cache: "no-store" });
      if (response.ok) {
        const result = await response.json() as { items?: Recommendation[] };
        if (active) setRecommendations(result.items ?? []);
      }
    }
    void initialize().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Wishlist could not be loaded.", "تعذّر تحميل قائمة الأمنيات.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, locale]);
  async function remove(productId: string) {
    setBusyId(productId); setError("");
    try {
      const response = await fetch(`/api/favorites/${encodeURIComponent(productId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Favorite could not be removed.", "تعذّر إزالة العنصر من المفضلة."));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Favorite could not be removed.", "تعذّر إزالة العنصر من المفضلة.")); }
    finally { setBusyId(""); }
  }
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-[var(--surface)] shadow-clay-raised px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/account/orders" className="text-sm">{t("My orders", "طلباتي")}</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Saved items", "العناصر المحفوظة")}</p><div className="mt-2 flex items-end justify-between gap-3"><h1 className="text-3xl font-semibold text-[var(--color-ink-950)]">{t("My wishlist", "قائمة أمنياتي")}</h1><p className="text-sm text-[var(--muted)]">{items.length} {t("saved", "محفوظ")}</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} {error.toLowerCase().includes("sign in") && <AuthReturnLink href="/login" className="ml-1 font-semibold underline">{t("Sign in", "تسجيل الدخول")}</AuthReturnLink>}</p>}
      {loading ? <div aria-label={t("Loading wishlist", "جارٍ تحميل قائمة الأمنيات")} className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised"><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="block">{item.product.image ? <img src={item.product.image.url} alt={item.product.image.altText || item.product.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-[var(--surface-soft)]" />}<div className="p-5"><p className="text-xs text-[var(--muted)]">{item.product.store.name}</p><h2 className="mt-1 font-semibold text-[var(--color-ink-950)]">{item.product.name}</h2><p className="mt-3 text-lg font-semibold">{t("Select a market to view pricing", "اختر سوقًا لعرض الأسعار")}</p></div></Link><div className="px-5 pb-5"><button disabled={busyId===item.product.id} onClick={() => void remove(item.product.id)} className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50">{busyId===item.product.id ? t("Removing…", "جارٍ الإزالة…") : t("Remove from wishlist", "إزالة من قائمة الأمنيات")}</button></div></article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-8 text-center"><p className="font-semibold text-[var(--color-ink-950)]">{t("Your wishlist is empty", "قائمة أمنياتك فارغة")}</p><p className="mt-2 text-sm text-[var(--muted)]">{t("Save products to keep them close while you browse.", "احفظ المنتجات للرجوع إليها أثناء التصفح.")}</p><Link href="/" className="mt-5 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{t("Explore marketplace", "استكشف السوق")}</Link></div> : null}
    </div>
  </main>;
}
