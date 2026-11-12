"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Order = { id: string; orderNumber: string; status: string; currencyCode: string; currency: { minorUnit: number }; totalMinor: string; placedAt: string; vendorOrders: Array<{ id: string; store: { name: string } }> };
function money(value: string, code: string, unit: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(value) / (10 ** unit)); }

export default function CustomerOrdersPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || t("Could not sign out. Please try again.", "تعذّر تسجيل الخروج. حاول مرة أخرى."));
      router.push("/login?returnTo=%2Faccount%2Forders");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not sign out. Please try again.", "تعذّر تسجيل الخروج. حاول مرة أخرى."));
    } finally { setSigningOut(false); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/orders", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || t("Order history could not be loaded.", "تعذّر تحميل سجل الطلبات."));
      if (active) setOrders(data.orders || []);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t("Order history could not be loaded.", "تعذّر تحميل سجل الطلبات.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-[var(--surface)] shadow-clay-raised px-5 py-5"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2"><Link href="/notifications" className="text-sm">{t("Notifications", "الإشعارات")}</Link><Link href="/account/messages" className="text-sm">{t("Messages", "الرسائل")}</Link><Link href="/account/reviews" className="text-sm">{t("My reviews", "تقييماتي")}</Link><Link href="/account/returns" className="text-sm">{t("Returns", "المرتجعات")}</Link><Link href="/account/wishlist" className="text-sm">{t("Wishlist", "قائمة الرغبات")}</Link><Link href="/account/questions" className="text-sm">{t("My questions", "أسئلتي")}</Link><Link href="/account/support" className="text-sm">{t("Support", "الدعم")}</Link><Link href="/account/profile" className="text-sm">{t("My account", "حسابي")}</Link><button type="button" onClick={signOut} disabled={signingOut} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--color-ink-800)] disabled:opacity-50">{signingOut ? t("Signing out…", "جارٍ تسجيل الخروج…") : t("Sign out", "تسجيل الخروج")}</button></div></div></header>
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-5 sm:py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Your account", "حسابك")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Order history", "سجل الطلبات")}</h1>
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : orders.length ? <div className="mt-6 space-y-3">{orders.map((order) => <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-5 transition hover:border-[var(--color-lavender-600)]"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{order.orderNumber}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(order.placedAt).toLocaleDateString()} · {order.vendorOrders.map((vendor) => vendor.store.name).join(", ")}</p></div><div className="text-right"><p className="font-semibold tabular-nums">{money(order.totalMinor, order.currencyCode, order.currency.minorUnit)}</p><p className="mt-1 text-xs text-[var(--muted)]"><StatusBadge locale={locale} status={order.status} /></p></div></div></Link>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-clay-raised p-8 text-center"><p className="font-semibold">{t("No orders yet", "لا توجد طلبات بعد")}</p><Link href="/products" className="mt-4 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{t("Explore products", "استكشف المنتجات")}</Link></div> : null}
    </div>
  </main>;
}
