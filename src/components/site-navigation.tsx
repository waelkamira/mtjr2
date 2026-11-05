import Link from "next/link";
import MarketplaceSearchBox from "@/features/storefront/marketplace-search-box";
import { getCurrentSession } from "@/server/identity/current-session";

export default async function SiteNavigation() {
  let session = null;
  try {
    session = await getCurrentSession();
  } catch {
    // Keep public navigation available if the identity database is temporarily unavailable.
  }

  const accountLabel = session?.user.displayName?.trim() || "My account";

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[var(--surface)]/90 shadow-[0_8px_28px_rgba(74,62,103,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-5 lg:px-10">
        <Link href="/" aria-label="Mtjr home" className="shrink-0 rounded-2xl px-3 py-2 text-2xl font-bold tracking-tight text-[var(--color-lavender-950)] drop-shadow-[0_2px_0_rgba(255,255,255,0.8)]">
          mtjr<span className="text-[var(--color-copper-600)]">.</span>
        </Link>

        <MarketplaceSearchBox />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Link href="/cart" className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-lavender-100)]">Cart</Link>
          {session ? (
            <>
              <Link href="/account/favorites" className="clay-interactive hidden rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-mint-100)] md:inline-flex">Favorites</Link>
              <Link href="/account/orders" className="clay-interactive hidden rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-mint-100)] md:inline-flex">Orders</Link>
              <Link href="/account" className="clay-interactive rounded-xl border border-white/70 bg-[var(--color-lavender-600)] px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-clay)] transition hover:bg-[var(--color-lavender-800)]">{accountLabel}</Link>

            </>
          ) : (
            <>
              <Link href="/login" className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-mint-100)]">Sign in</Link>
              <Link href="/register" className="rounded-lg bg-[var(--color-forest-800)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-950)]">Join</Link>

            </>
          )}
        </div>
      </div>

      <nav aria-label="Main navigation" className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 pb-3 text-sm text-[var(--color-ink-600)] sm:px-5 lg:px-10">
        <Link href="/" className="clay-surface-inset whitespace-nowrap rounded-full px-4 py-2 font-semibold text-[var(--color-lavender-800)]">Home</Link>
        <Link href="/products" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Shop</Link>
        <Link href="/categories" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Categories</Link>
        <Link href="/brands" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Brands</Link>
        <Link href="/stores" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Stores</Link>
        <Link href="/seller" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Sell on Mtjr</Link>
        {session && (
          <>
            <Link href="/account/messages" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Messages</Link>
            <Link href="/notifications" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Notifications</Link>
          </>
        )}
        <Link href="/terms" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Terms</Link>
        <Link href="/privacy" className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]">Privacy</Link>
      </nav>
    </header>
  );
}
