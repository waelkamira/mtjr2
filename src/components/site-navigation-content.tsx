"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MarketplaceSearchBox from "@/features/storefront/marketplace-search-box";
import AuthReturnLink from "@/components/auth-return-link";
import LanguageSwitcher from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { translate, type Locale } from "@/lib/locale";

type AccountSummary = {
  name: string;
  accountType: string;
  accountTypeError: string | null;
  profileImageUrl: string | null;
};

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/brands", label: "Brands" },
  { href: "/stores", label: "Stores" },
  { href: "/seller", label: "Sell on Mtjr" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" }
];

function localizeAccountType(locale: Locale, accountType: string) {
  const accountTypes: Record<string, string> = {
    "Super Admin": "مدير عام",
    Admin: "مدير",
    Seller: "بائع",
    Support: "الدعم",
    "Seller applicant": "متقدم للبيع",
    Customer: "عميل",
    User: "مستخدم",
    "Account type unavailable": "نوع الحساب غير متاح"
  };
  return locale === "ar" ? accountTypes[accountType] ?? accountType : accountType;
}

type NavigationIconName = "home" | "shop" | "grid" | "tag" | "store" | "sell" | "cart" | "heart" | "orders" | "messages" | "bell" | "admin" | "user" | "login" | "logout" | "about" | "contact" | "document" | "menu";
function NavigationIcon({ name, className = "h-4 w-4" }: { name: NavigationIconName; className?: string }) {
  const paths: Record<NavigationIconName, React.ReactNode> = {
    home: <path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7" />,
    shop: <path d="M4 7h16l-1 14H5L4 7ZM8 7a4 4 0 0 1 8 0" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    tag: <path d="M20 13 13 20 3 10V3h7l10 10Z" />, store: <path d="M3 10h18l-2-7H5l-2 7ZM5 10v11h14V10" />,
    sell: <path d="m3 11 9-8 9 8v10H3V11" />, cart: <><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.5 12h12L21 7H5" /></>,
    heart: <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />,
    orders: <path d="M7 3h10l3 3v15H4V3h3ZM8 11h8M8 15h8" />, messages: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 21l1.8-4.5A8.3 8.3 0 1 1 21 11.5Z" />,
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />, admin: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>, login: <path d="m10 17 5-5-5-5M15 12H3M12 3h7v18h-7" />,
    logout: <path d="m14 17 5-5-5-5M19 12H8M12 3H5v18h7" />, about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
    contact: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>, document: <path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6" />, menu: <path d="M4 7h16M4 12h16M4 17h16" />
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
const navigationLabels: Record<string, { ar: string; icon: NavigationIconName }> = {
  Home:{ar:"الرئيسية",icon:"home"}, Shop:{ar:"تسوق",icon:"shop"}, Categories:{ar:"الفئات",icon:"grid"}, Brands:{ar:"العلامات التجارية",icon:"tag"},
  Stores:{ar:"المتاجر",icon:"store"}, "Sell on Mtjr":{ar:"بع على متجر",icon:"sell"}, About:{ar:"من نحن",icon:"about"}, Contact:{ar:"اتصل بنا",icon:"contact"},
  Terms:{ar:"الشروط والأحكام",icon:"document"}, Privacy:{ar:"سياسة الخصوصية",icon:"document"}, Cart:{ar:"السلة",icon:"cart"}, Favorites:{ar:"المفضلة",icon:"heart"},
  Orders:{ar:"الطلبات",icon:"orders"}, Messages:{ar:"الرسائل",icon:"messages"}, Notifications:{ar:"الإشعارات",icon:"bell"}, "Control panel":{ar:"لوحة التحكم",icon:"admin"},
  "My profile":{ar:"ملفي الشخصي",icon:"user"}, "My account":{ar:"حسابي",icon:"user"}, "Sign in":{ar:"تسجيل الدخول",icon:"login"}, Join:{ar:"إنشاء حساب",icon:"user"}, "Sign out":{ar:"تسجيل الخروج",icon:"logout"}
};
function localizedNavigationLabel(locale: Locale, label: string) { const item = navigationLabels[label]; return item ? translate(locale, label, item.ar) : label; }
function navigationIconFor(label: string): NavigationIconName { return navigationLabels[label]?.icon ?? "document"; }

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("") || "U";
}

function isSafeProfileImageUrl(value: string | null) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function Avatar({ account, size = "md" }: { account: AccountSummary; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-[var(--color-lavender-100)] font-bold text-[var(--color-lavender-800)] shadow-[var(--shadow-clay)] ${sizeClass}`}
    >
      {isSafeProfileImageUrl(account.profileImageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.profileImageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : initials(account.name)}
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function SiteNavigationContent({ account }: { account: AccountSummary | null }) {
  const { locale } = useLocale();
  const isAdministrator = account?.accountType === "Admin" || account?.accountType === "Super Admin";
  const controlPanelHref = account?.accountType === "Super Admin" ? "/admin/control-panel" : "/admin/dashboard";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!mobileMenuRef.current?.contains(target)) setMobileOpen(false);
      if (!accountMenuRef.current?.contains(target)) setAccountOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store"
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to sign out right now.");
      window.location.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign out right now.";
      setLogoutError(translate(locale, message, message === "Unable to sign out right now." ? "تعذر تسجيل الخروج الآن." : message));
    } finally {
      setLogoutBusy(false);
    }
  }

  const signedInLinks = [
    { href: "/account/messages", label: "Messages" },
    { href: "/notifications", label: "Notifications" }
  ];
  const mobileLinks = [
    { href: "/cart", label: translate(locale, "Cart", "السلة") },
    ...(account
      ? [
          { href: "/account/favorites", label: translate(locale, "Favorites", "المفضلة") },
          { href: "/account/orders", label: translate(locale, "Orders", "الطلبات") }
        ]
      : []),
    ...publicLinks.slice(0, 8).map((link) => ({
      ...link,
      label: translate(locale, link.label, {
        Home: "الرئيسية",
        Shop: "تسوق",
        Categories: "الفئات",
        Brands: "العلامات التجارية",
        Stores: "المتاجر",
        "Sell on Mtjr": "بع على متجر"
      }[link.label] ?? link.label)
    })),
    ...(account ? signedInLinks : []),
    ...(isAdministrator ? [{ href: controlPanelHref, label: translate(locale, "Control panel", "لوحة التحكم") }] : []),
    ...publicLinks.slice(6).map((link) => ({
      ...link,
      label: translate(locale, link.label, { About: "من نحن", Contact: "اتصل بنا", Terms: "الشروط", Privacy: "الخصوصية" }[link.label] ?? link.label)
    }))
  ];

  const menuLinkClass = "flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-orange)]";

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[var(--surface)]/95 shadow-[var(--shadow-clay)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 pr-16 py-3 sm:px-5 sm:pr-16 md:pr-0 lg:px-10">
        <Link
          href="/"
          aria-label="Mtjr home"
          className="hidden shrink-0 rounded-2xl px-3 py-2 text-2xl font-bold tracking-tight text-[var(--color-lavender-950)] drop-shadow-[0_2px_0_rgba(255,255,255,0.8)] md:inline-flex"
        >
          mtjr<span className="text-[var(--color-copper-600)]">.</span>
        </Link>

        <MarketplaceSearchBox />

        <div className="hidden shrink-0 items-center gap-1 md:ml-auto md:flex md:gap-2">
          {isAdministrator && (
            <Link href={controlPanelHref} className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]">
              <NavigationIcon name="admin" />{localizedNavigationLabel(locale, "Control panel")}
            </Link>
          )}
          <Link
            href="/cart"
            className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"
          >
            <NavigationIcon name="cart" />{localizedNavigationLabel(locale, "Cart")}
          </Link>
          {account && (
            <>
              <Link
                href="/account/favorites"
                className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"
              >
                <NavigationIcon name="heart" />{localizedNavigationLabel(locale, "Favorites")}
              </Link>
              <Link
                href="/account/orders"
                className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"
              >
                <NavigationIcon name="orders" />{localizedNavigationLabel(locale, "Orders")}
              </Link>
            </>
          )}

          {account ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-label={translate(locale, `Account menu for ${account.name}`, `قائمة حساب ${account.name}`)}
                onClick={() => {
                  setAccountOpen((open) => !open);
                  setLogoutError("");
                }}
                className="clay-interactive flex max-w-[min(42vw,15rem)] items-center gap-2 rounded-2xl border border-[var(--border)] bg-white py-1.5 pl-1.5 pr-2.5 text-left text-[var(--foreground)] shadow-[var(--shadow-clay)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] sm:gap-2.5 sm:pr-3"
              >
                <Avatar account={account} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-[var(--color-lavender-950)] sm:text-sm">
                    {account.name}
                  </span>
                  <span className="hidden text-[11px] font-medium text-[var(--muted)] sm:block">
                    {localizeAccountType(locale, account.accountType)}
                  </span>
                </span>
                <ChevronIcon />
              </button>
              {accountOpen && (
                <div
                  role="group"
                  aria-label={translate(locale, "Account options", "خيارات الحساب")}
                  className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/80 bg-[var(--surface)] p-2 shadow-[var(--shadow-floating)]"
                >
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--color-lavender-50)] p-3">
                    <Avatar account={account} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[var(--color-lavender-950)]">{account.name}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">{localizeAccountType(locale, account.accountType)}</span>
                    </span>
                  </div>
                  {account.accountTypeError && (
                    <p role="status" className="px-3 py-2 text-xs text-[var(--color-danger)]">{translate(locale, account.accountTypeError, "تعذر تحميل نوع حسابك.")}</p>
                  )}
                  <Link href="/account/profile" onClick={() => setAccountOpen(false)} className={menuLinkClass}><NavigationIcon name="user" />{localizedNavigationLabel(locale, "My profile")}</Link>
                  <Link href="/account" onClick={() => setAccountOpen(false)} className={menuLinkClass}><NavigationIcon name="user" />{localizedNavigationLabel(locale, "My account")}</Link>
                  {logoutError && <p role="alert" className="px-3 py-2 text-xs text-[var(--color-danger)]">{logoutError}</p>}
                  <button
                    type="button"
                    disabled={logoutBusy}
                    onClick={logout}
                    className={`${menuLinkClass} w-full text-start text-[var(--color-danger)] disabled:cursor-wait disabled:opacity-60`}
                  >
                    {logoutBusy ? translate(locale, "Signing out…", "جارٍ تسجيل الخروج…") : translate(locale, "Sign out", "تسجيل الخروج")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <AuthReturnLink
                href="/login"
                className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"
              >
                <NavigationIcon name="login" />{localizedNavigationLabel(locale, "Sign in")}
              </AuthReturnLink>
              <AuthReturnLink
                href="/register"
                className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-[var(--color-orange)] bg-[var(--color-orange)] px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-clay)] transition hover:border-[var(--action-hover)] hover:bg-[var(--action-hover)] hover:text-white"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.75 16a5.25 5.25 0 0 1 10.5 0M16 5.5v5M13.5 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {localizedNavigationLabel(locale, "Join")}
              </AuthReturnLink>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 pb-3 sm:px-5 lg:px-10">
        <nav aria-label={translate(locale, "Main navigation", "القائمة الرئيسية")} className="hidden gap-2 overflow-x-auto text-sm text-[var(--color-ink-600)] md:flex">
          {publicLinks.slice(0, 6).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 font-medium transition ${link.href === "/" ? "border-[var(--color-orange)] bg-lime-100 text-[var(--foreground)]" : "border-transparent text-[var(--foreground)] hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"}`}
            >
              {translate(locale, link.label, {
                Home: "الرئيسية",
                Shop: "تسوق",
                Categories: "الفئات",
                Brands: "العلامات التجارية",
                Stores: "المتاجر",
                "Sell on Mtjr": "بع على متجر",
                About: "من نحن",
                Contact: "اتصل بنا",
                Terms: "الشروط",
                Privacy: "الخصوصية"
              }[link.label] ?? link.label)}
            </Link>
          ))}
          {account && signedInLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-transparent px-4 py-2 font-medium text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"
            >
              <NavigationIcon name={navigationIconFor(link.label)} />{localizedNavigationLabel(locale, link.label)}
            </Link>
          ))}
          {publicLinks.slice(6).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-transparent px-4 py-2 font-medium text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgb(69_69_69/8%)]"
            >
              {localizedNavigationLabel(locale, link.label)}
            </Link>
          ))}
        </nav>

        <div className="absolute right-4 top-3 sm:right-5 md:hidden" ref={mobileMenuRef}>
          <button
            type="button"
            aria-label={translate(locale, "Open navigation menu", "فتح قائمة التنقل")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-main-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] shadow-[var(--shadow-clay)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)]"
          >
            {mobileOpen ? <MenuIcon open /> : <NavigationIcon name="menu" className="h-5 w-5" />}
            <span className="sr-only">{mobileOpen
              ? translate(locale, "Close navigation menu", "إغلاق قائمة التنقل")
              : translate(locale, "Open navigation menu", "فتح قائمة التنقل")}</span>
          </button>

          {mobileOpen && (
            <nav
              id="mobile-main-navigation"
              aria-label={translate(locale, "Main navigation", "القائمة الرئيسية")}
              className="absolute right-0 top-full z-50 mt-2 max-h-[min(75dvh,38rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/80 bg-[var(--surface)] p-2 shadow-[var(--shadow-floating)]"
            >
              <div className="mb-2 border-b border-[var(--border)] p-2">
                <LanguageSwitcher compact />
              </div>
              {account ? (
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-[var(--color-lavender-50)] p-3">
                  <Avatar account={account} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--color-lavender-950)]">{account.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{localizeAccountType(locale, account.accountType)}</span>
                  </span>
                </div>
              ) : (
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-[var(--color-lavender-50)] p-3">
                  <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-lavender-100)] text-sm font-bold text-[var(--color-lavender-800)]">?</span>
                  <span className="text-sm font-semibold text-[var(--color-lavender-950)]">{translate(locale, "Welcome to Mtjr", "مرحبًا بك في متجر")}</span>
                </div>
              )}
              {mobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={menuLinkClass}
                >
                  {localizedNavigationLabel(locale, link.label)}
                </Link>
              ))}
              {account ? (
                <>
                  <Link href="/account/profile" onClick={() => setMobileOpen(false)} className={menuLinkClass}><NavigationIcon name="user" />{localizedNavigationLabel(locale, "My profile")}</Link>
                  <Link href="/account" onClick={() => setMobileOpen(false)} className={menuLinkClass}><NavigationIcon name="user" />{localizedNavigationLabel(locale, "My account")}</Link>
                  {logoutError && <p role="alert" className="px-3 py-2 text-xs text-[var(--color-danger)]">{logoutError}</p>}
                  <button
                    type="button"
                    disabled={logoutBusy}
                    onClick={logout}
                    className={`${menuLinkClass} w-full text-left text-[var(--color-danger)] disabled:cursor-wait disabled:opacity-60`}
                  >
                    {logoutBusy ? translate(locale, "Signing out…", "جارٍ تسجيل الخروج…") : translate(locale, "Sign out", "تسجيل الخروج")}
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] p-2">
                  <AuthReturnLink href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-orange)] bg-[var(--color-orange)] px-3 py-3 text-center text-sm font-semibold text-white transition hover:bg-[var(--action-hover)] hover:text-white"><NavigationIcon name="login" />{localizedNavigationLabel(locale, "Sign in")}</AuthReturnLink>
                  <AuthReturnLink href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-center text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--color-orange)] hover:bg-white hover:text-[var(--foreground)]">
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.75 16a5.25 5.25 0 0 1 10.5 0M16 5.5v5M13.5 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {localizedNavigationLabel(locale, "Join")}
                  </AuthReturnLink>
                </div>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
