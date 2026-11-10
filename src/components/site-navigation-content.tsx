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
    { href: "/account/messages", label: translate(locale, "Messages", "الرسائل") },
    { href: "/notifications", label: translate(locale, "Notifications", "الإشعارات") }
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

  const menuLinkClass =
    "block rounded-xl px-4 py-3 text-sm font-medium text-[var(--color-ink-800)] transition hover:bg-[var(--color-lavender-50)] hover:text-[var(--color-lavender-950)] focus-visible:outline-offset-2";

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
            <Link href={controlPanelHref} className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-lavender-100)]">
              {translate(locale, "Control panel", "لوحة التحكم")}
            </Link>
          )}
          <Link
            href="/cart"
            className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-lavender-100)]"
          >
            {translate(locale, "Cart", "السلة")}
          </Link>
          {account && (
            <>
              <Link
                href="/account/favorites"
                className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-mint-100)]"
              >
                {translate(locale, "Favorites", "المفضلة")}
              </Link>
              <Link
                href="/account/orders"
                className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-mint-100)]"
              >
                {translate(locale, "Orders", "الطلبات")}
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
                className="clay-interactive flex max-w-[min(42vw,15rem)] items-center gap-2 rounded-2xl border border-white/80 bg-[var(--surface)] py-1.5 pl-1.5 pr-2.5 text-left shadow-[var(--shadow-clay)] transition hover:bg-[var(--color-lavender-50)] sm:gap-2.5 sm:pr-3"
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
                  <Link href="/account/profile" onClick={() => setAccountOpen(false)} className={menuLinkClass}>{translate(locale, "My profile", "ملفي الشخصي")}</Link>
                  <Link href="/account" onClick={() => setAccountOpen(false)} className={menuLinkClass}>{translate(locale, "My account", "حسابي")}</Link>
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
                className="clay-interactive rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-lavender-800)] transition hover:bg-[var(--color-mint-100)]"
              >
                {translate(locale, "Sign in", "تسجيل الدخول")}
              </AuthReturnLink>
              <AuthReturnLink
                href="/register"
                className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-white/70 bg-[var(--color-lavender-600)] px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-clay)] transition hover:bg-[var(--action-hover)]"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.75 16a5.25 5.25 0 0 1 10.5 0M16 5.5v5M13.5 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {translate(locale, "Join", "انضم")}
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
              className={`whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)] ${link.href === "/" ? "clay-surface-inset font-semibold text-[var(--color-lavender-800)]" : ""}`}
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
              className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]"
            >
              {translate(locale, link.label, { About: "من نحن", Contact: "اتصل بنا", Terms: "الشروط", Privacy: "الخصوصية" }[link.label] ?? link.label)}
            </Link>
          ))}
          {publicLinks.slice(6).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-[var(--color-lavender-100)] hover:text-[var(--color-lavender-950)]"
            >
              {link.label}
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
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--color-orange)] shadow-[var(--shadow-clay)]"
          >
            <MenuIcon open={mobileOpen} />
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
                  {link.label}
                </Link>
              ))}
              {account ? (
                <>
                  <Link href="/account/profile" onClick={() => setMobileOpen(false)} className={menuLinkClass}>{translate(locale, "My profile", "ملفي الشخصي")}</Link>
                  <Link href="/account" onClick={() => setMobileOpen(false)} className={menuLinkClass}>{translate(locale, "My account", "حسابي")}</Link>
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
                  <AuthReturnLink href="/login" className="rounded-xl bg-[var(--color-lavender-600)] px-3 py-3 text-center text-sm font-semibold text-white">{translate(locale, "Sign in", "تسجيل الدخول")}</AuthReturnLink>
                  <AuthReturnLink href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-3 text-center text-sm font-semibold text-[var(--color-lavender-800)]">
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.75 16a5.25 5.25 0 0 1 10.5 0M16 5.5v5M13.5 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {translate(locale, "Join", "انضم")}
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
