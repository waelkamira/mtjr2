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
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--color-ivory-50)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-5 lg:px-10">
        <Link href="/" aria-label="Mtjr home" className="shrink-0 text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">
          mtjr<span className="text-[var(--color-copper-600)]">.</span>
        </Link>

        <MarketplaceSearchBox />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Link href="/cart" className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--color-forest-900)] transition hover:bg-[var(--color-sage-100)]">Cart</Link>
          {session ? (
            <>
              <Link href="/account/favorites" className="hidden rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--color-forest-900)] transition hover:bg-[var(--color-sage-100)] md:inline-flex">Favorites</Link>
              <Link href="/account/orders" className="hidden rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--color-forest-900)] transition hover:bg-[var(--color-sage-100)] md:inline-flex">Orders</Link>
              <Link href="/account" className="rounded-lg bg-[var(--color-forest-800)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-950)]">{accountLabel}</Link>

            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--color-forest-900)] transition hover:bg-[var(--color-sage-100)]">Sign in</Link>
              <Link href="/register" className="rounded-lg bg-[var(--color-forest-800)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-950)]">Join</Link>

            </>
          )}
        </div>
      </div>

      <nav aria-label="Main navigation" className="mx-auto flex max-w-[1440px] gap-6 overflow-x-auto px-4 pb-3 text-sm text-[var(--color-ink-700)] sm:px-5 lg:px-10">
        <Link href="/" className="whitespace-nowrap font-medium text-[var(--color-forest-800)]">Home</Link>
        <Link href="/products" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Shop</Link>
        <Link href="/categories" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Categories</Link>
        <Link href="/brands" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Brands</Link>
        <Link href="/stores" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Stores</Link>
        <Link href="/seller" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Sell on Mtjr</Link>
        {session && (
          <>
            <Link href="/account/messages" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Messages</Link>
            <Link href="/notifications" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Notifications</Link>
          </>
        )}
        <Link href="/terms" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Terms</Link>
        <Link href="/privacy" className="whitespace-nowrap hover:text-[var(--color-forest-950)]">Privacy</Link>
      </nav>
    </header>
  );
}
