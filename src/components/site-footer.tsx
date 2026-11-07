// import Link from "next/link";
// import { translate, type Locale } from "@/lib/locale";

// type FooterLink = { href: string; english: string; arabic: string };

// const marketplaceLinks: FooterLink[] = [
//   { href: "/products", english: "Shop all products", arabic: "تسوق جميع المنتجات" },
//   { href: "/categories", english: "Categories", arabic: "الفئات" },
//   { href: "/brands", english: "Brands", arabic: "العلامات التجارية" },
//   { href: "/stores", english: "Stores", arabic: "المتاجر" },
//   { href: "/seller", english: "Sell on Mtjr", arabic: "بع على متجر" }
// ];

// const helpLinks: FooterLink[] = [
//   { href: "/contact", english: "Contact us", arabic: "اتصل بنا" },
//   { href: "/account/support", english: "Customer support", arabic: "دعم العملاء" },
//   { href: "/account/orders", english: "My orders", arabic: "طلباتي" }
// ];

// const informationLinks: FooterLink[] = [
//   { href: "/about", english: "About Mtjr", arabic: "عن متجر" },
//   { href: "/terms", english: "Terms of use", arabic: "شروط الاستخدام" },
//   { href: "/privacy", english: "Privacy notice", arabic: "إشعار الخصوصية" }
// ];

// function FooterLinks({ links, locale }: { links: FooterLink[]; locale: Locale }) {
//   return (
//     <ul className="mt-4 space-y-3">
//       {links.map((link) => (
//         <li key={link.href}>
//           <Link
//             href={link.href}
//             className="text-sm text-[var(--muted)] transition hover:text-[var(--color-orange)]"
//           >
//             {translate(locale, link.english, link.arabic)}
//           </Link>
//         </li>
//       ))}
//     </ul>
//   );
// }

// export default function SiteFooter({
//   locale,
//   contactEmail
// }: {
//   locale: Locale;
//   contactEmail: string | null;
// }) {
//   const year = new Date().getFullYear();

//   return (
//     <footer className="mt-16 border-t text-white border-[var(--border)] bg-[#454545]">
//       <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
//         <section>
//           <Link href="/" className="text-2xl font-bold tracking-tight text-[var(--color-onyx)]">
//             mtjr<span className="text-[var(--color-orange)]">.</span>
//           </Link>
//           <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
//             {translate(
//               locale,
//               "A global marketplace connecting shoppers with independent stores.",
//               "سوق عالمي يربط المتسوقين بالمتاجر المستقلة."
//             )}
//           </p>
//           <div className="mt-5">
//             <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-onyx)]">
//               {translate(locale, "Email", "البريد الإلكتروني")}
//             </p>
//             {contactEmail ? (
//               <a
//                 href={`mailto:${contactEmail}`}
//                 className="mt-1 inline-block break-all text-sm text-[var(--muted)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--color-orange)]"
//               >
//                 {contactEmail}
//               </a>
//             ) : (
//               <Link href="/contact" className="mt-1 inline-block text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--color-orange)]">
//                 {translate(locale, "Contact details", "بيانات التواصل")}
//               </Link>
//             )}
//           </div>
//         </section>

//         <nav aria-label={translate(locale, "Marketplace", "السوق")}>
//           <h2 className="text-sm font-bold text-[var(--color-onyx)]">
//             {translate(locale, "Marketplace", "السوق")}
//           </h2>
//           <FooterLinks links={marketplaceLinks} locale={locale} />
//         </nav>

//         <nav aria-label={translate(locale, "Help", "المساعدة")}>
//           <h2 className="text-sm font-bold text-[var(--color-onyx)]">
//             {translate(locale, "Help & orders", "المساعدة والطلبات")}
//           </h2>
//           <FooterLinks links={helpLinks} locale={locale} />
//         </nav>

//         <nav aria-label={translate(locale, "Information", "معلومات")}>
//           <h2 className="text-sm font-bold text-[var(--color-onyx)]">
//             {translate(locale, "Information", "معلومات")}
//           </h2>
//           <FooterLinks links={informationLinks} locale={locale} />
//         </nav>
//       </div>

//       <div className="border-t border-[var(--border)]">
//         <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between lg:px-10">
//           <p>© {year} Mtjr. {translate(locale, "All rights reserved.", "جميع الحقوق محفوظة.")}</p>
//           <div className="flex gap-5">
//             <Link href="/terms" className="hover:text-[var(--color-orange)]">{translate(locale, "Terms", "الشروط")}</Link>
//             <Link href="/privacy" className="hover:text-[var(--color-orange)]">{translate(locale, "Privacy", "الخصوصية")}</Link>
//             <Link href="/contact" className="hover:text-[var(--color-orange)]">{translate(locale, "Contact", "التواصل")}</Link>
//           </div>
//         </div>
//       </div>
//     </footer>
//   );
// }
import Link from "next/link";
import type { ReactNode } from "react";
import { translate, type Locale } from "@/lib/locale";

/* ------------------------------------------------------------------ */
/*  Icons — SVG مدمجة بدون مكتبات خارجية                                */
/* ------------------------------------------------------------------ */

const iconPaths = {
  bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  store: <><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12v8h14v-8" /><path d="M10 20v-5h4v5" /></>,
  rocket: <><path d="M5 15c-1.5 1.5-2 6-2 6s4.5-.5 6-2c.9-.9.9-2.3 0-3.2a2.2 2.2 0 0 0-4 0Z" /><path d="M15 12 12 9c0-4 2-7 8-8 -1 6-4 8-8 8Z" /><path d="M9 12H6l3-4h3" /><path d="M12 15v3l4-3v-3" /></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="3" /><path d="m3.5 7 7.3 5.2a2 2 0 0 0 2.4 0L20.5 7" /></>,
  lifebuoy: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.6" /><path d="m5.6 5.6 3.8 3.8M14.6 14.6l3.8 3.8M18.4 5.6l-3.8 3.8M9.4 14.6l-3.8 3.8" /></>,
  box: <><path d="m12 2.8 8.5 4.6v9.2L12 21.2 3.5 16.6V7.4Z" /><path d="M3.5 7.4 12 12l8.5-4.6M12 12v9.2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8h.01" /></>,
  doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  shield: <><path d="M12 2.8 20 6v6c0 4.6-3.3 7.9-8 9.2-4.7-1.3-8-4.6-8-9.2V6Z" /><path d="m9 12 2 2 4-4" /></>,
  truck: <><path d="M3 6.5h10v9H3zM13 9.5h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.9" /><circle cx="17" cy="17.5" r="1.9" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7M12 14.5v2.5" /></>,
  refresh: <><path d="M3.5 12a8.5 8.5 0 0 1 14.6-6M20.5 12a8.5 8.5 0 0 1-14.6 6" /><path d="M18.5 2.5V6H15M5.5 21.5V18H9" /></>,
  headset: <><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="2.5" y="13" width="4.5" height="6" rx="2" /><rect x="17" y="13" width="4.5" height="6" rx="2" /><path d="M20 19v.5a2.5 2.5 0 0 1-2.5 2.5H13" /></>,
  sparkles: <><path d="m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 17l-1.9-5.3L5 9.8l5.1-1.9Z" /><path d="M18.5 15.5 19.4 18l2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" /></>,
  arrowUp: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  send: <><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8Z" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.2 9.5h17.6M3.2 14.5h17.6" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" /></>
} as const;

type IconName = keyof typeof iconPaths;

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {iconPaths[name] as ReactNode}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  البيانات                                                           */
/* ------------------------------------------------------------------ */

type FooterLink = { href: string; english: string; arabic: string; icon: IconName };

const marketplaceLinks: FooterLink[] = [
  { href: "/products", english: "Shop all products", arabic: "تسوق جميع المنتجات", icon: "bag" },
  { href: "/categories", english: "Categories", arabic: "الفئات", icon: "grid" },
  { href: "/brands", english: "Brands", arabic: "العلامات التجارية", icon: "tag" },
  { href: "/stores", english: "Stores", arabic: "المتاجر", icon: "store" },
  { href: "/seller", english: "Sell on Mtjr", arabic: "بع على متجر", icon: "rocket" }
];

const helpLinks: FooterLink[] = [
  { href: "/contact", english: "Contact us", arabic: "اتصل بنا", icon: "mail" },
  { href: "/account/support", english: "Customer support", arabic: "دعم العملاء", icon: "lifebuoy" },
  { href: "/account/orders", english: "My orders", arabic: "طلباتي", icon: "box" }
];

const informationLinks: FooterLink[] = [
  { href: "/about", english: "About Mtjr", arabic: "عن متجر", icon: "info" },
  { href: "/terms", english: "Terms of use", arabic: "شروط الاستخدام", icon: "doc" },
  { href: "/privacy", english: "Privacy notice", arabic: "إشعار الخصوصية", icon: "shield" }
];

const socials = [
  {
    name: "X",
    href: "https://x.com",
    path: "M18.24 2.25h3.31l-7.23 8.26L22.83 21.75H16.17l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25H8.08l4.71 6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12Z"
  },
  {
    name: "Instagram",
    href: "https://instagram.com",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.3-7.02a.97.97 0 1 1-1.94 0 .97.97 0 0 1 1.94 0Z"
  },
  {
    name: "Facebook",
    href: "https://facebook.com",
    path: "M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3 0-1.3-.1-2.45-.1-2.42 0-4.08 1.48-4.08 4.2v2.2H7.5V13h2.67v8Z"
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com",
    path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3Zm6 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.03-3.07-1.9-3.07-1.9 0-2.2 1.46-2.2 2.97V21H9Z"
  }
];

const trustBadges: { icon: IconName; en: [string, string]; ar: [string, string] }[] = [
  { icon: "truck", en: ["Fast delivery", "Worldwide shipping"], ar: ["توصيل سريع", "شحن لكل الدول"] },
  { icon: "lock", en: ["Secure payments", "256-bit encryption"], ar: ["دفع آمن", "تشفير كامل للبيانات"] },
  { icon: "refresh", en: ["Easy returns", "14-day return policy"], ar: ["إرجاع سهل", "خلال ١٤ يوماً"] },
  { icon: "headset", en: ["24/7 support", "We're here to help"], ar: ["دعم ٢٤/٧", "نحن هنا لمساعدتك"] }
];

const payments = ["VISA", "Mastercard", "mada", "Apple Pay", "PayPal"];

/* ------------------------------------------------------------------ */
/*  المكوّنات الفرعية                                                   */
/* ------------------------------------------------------------------ */

function FooterLinks({ links, locale }: { links: FooterLink[]; locale: Locale }) {
  return (
    <ul className="mt-5 space-y-1">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-white/60 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-orange)]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/45 transition-all duration-300 group-hover:border-[var(--color-orange)] group-hover:bg-[var(--color-orange)] group-hover:text-white">
              <Icon name={link.icon} className="h-[15px] w-[15px]" />
            </span>
            <span className="transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
              {translate(locale, link.english, link.arabic)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ColumnTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white">
      <span className="h-4 w-[3px] rounded-full bg-[var(--color-orange)]" />
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  الفوتر                                                             */
/* ------------------------------------------------------------------ */

export default function SiteFooter({
  locale,
  contactEmail
}: {
  locale: Locale;
  contactEmail: string | null;
}) {
  const year = new Date().getFullYear();
  const isRTL = locale === "ar";

  return (
    <footer
      dir={isRTL ? "rtl" : "ltr"}
      className="relative mt-24 overflow-hidden bg-[#454545] text-white"
    >
      {/* خط علوي متدرج + توهج زخرفي */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-orange)] to-transparent" />
      <div className="pointer-events-none absolute -top-40 start-1/4 h-80 w-80 rounded-full bg-[var(--color-orange)] opacity-[0.13] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-32 end-0 h-72 w-72 rounded-full bg-indigo-500 opacity-[0.10] blur-[110px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.03) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)"
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-5 lg:px-10">
        {/* ── النشرة البريدية ───────────────────────────── */}
        <section className="pt-14">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-6 backdrop-blur-sm sm:p-8">
            <div className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-[var(--color-orange)] opacity-20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--color-orange)] to-amber-400 text-white shadow-lg shadow-orange-900/30">
                  <Icon name="sparkles" className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                    {translate(locale, "Get the best deals first", "احصل على أفضل العروض أولاً")}
                  </h2>
                  <p className="mt-1 max-w-md text-sm leading-6 text-white/55">
                    {translate(
                      locale,
                      "Join our newsletter for exclusive offers, new stores and weekly picks.",
                      "اشترك في نشرتنا البريدية لتصلك العروض الحصرية والمتاجر الجديدة ومختارات أسبوعية."
                    )}
                  </p>
                </div>
              </div>

              <form
                action="/api/newsletter"
                method="post"
                className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto lg:min-w-[420px]"
              >
                <label htmlFor="footer-email" className="sr-only">
                  {translate(locale, "Email address", "البريد الإلكتروني")}
                </label>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 start-3.5 grid place-items-center text-white/35">
                    <Icon name="mail" className="h-[18px] w-[18px]" />
                  </span>
                  <input
                    id="footer-email"
                    name="email"
                    type="email"
                    required
                    placeholder={translate(locale, "you@example.com", "بريدك الإلكتروني")}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/30 ps-11 pe-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[var(--color-orange)] focus:bg-black/50 focus:ring-4 focus:ring-[var(--color-orange)]/20"
                  />
                </div>
                <button
                  type="submit"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-orange)] px-6 text-sm font-bold text-white shadow-lg shadow-orange-900/25 transition hover:brightness-110 active:scale-[0.98]"
                >
                  {translate(locale, "Subscribe", "اشترك")}
                  <Icon
                    name="send"
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ── شريط المزايا ──────────────────────────────── */}
        <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {trustBadges.map((badge) => (
            <div
              key={badge.icon}
              className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition-colors hover:border-white/15 hover:bg-white/[0.06]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[var(--color-orange)] transition-transform duration-300 group-hover:scale-110">
                <Icon name={badge.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {translate(locale, badge.en[0], badge.ar[0])}
                </p>
                <p className="truncate text-[11px] text-white/45">
                  {translate(locale, badge.en[1], badge.ar[1])}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* ── الشبكة الرئيسية ───────────────────────────── */}
        <div className="mt-14 grid gap-12 border-t border-white/[0.07] pt-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-10">
          {/* الهوية */}
          <section>
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-orange)] to-amber-500 text-lg font-black text-white shadow-lg shadow-orange-900/30 transition-transform group-hover:scale-105">
                m
              </span>
              <span className="text-2xl font-black tracking-tight text-white">
                mtjr<span className="text-[var(--color-orange)]">.</span>
              </span>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-7 text-white/55">
              {translate(
                locale,
                "A global marketplace connecting shoppers with independent stores.",
                "سوق عالمي يربط المتسوقين بالمتاجر المستقلة."
              )}
            </p>

            {/* بطاقة التواصل */}
            <div className="mt-6 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 pe-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-orange)]/15 text-[var(--color-orange)]">
                <Icon name="mail" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                  {translate(locale, "Email us", "راسلنا")}
                </p>
                {contactEmail ? (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="block truncate text-sm font-medium text-white/85 transition hover:text-[var(--color-orange)]"
                  >
                    {contactEmail}
                  </a>
                ) : (
                  <Link
                    href="/contact"
                    className="block text-sm font-medium text-white/85 transition hover:text-[var(--color-orange)]"
                  >
                    {translate(locale, "Contact details", "بيانات التواصل")}
                  </Link>
                )}
              </div>
            </div>

            {/* التواصل الاجتماعي */}
            <div className="mt-6 flex items-center gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-orange)] hover:bg-[var(--color-orange)] hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[17px] w-[17px]" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </section>

          <nav aria-label={translate(locale, "Marketplace", "السوق")}>
            <ColumnTitle>{translate(locale, "Marketplace", "السوق")}</ColumnTitle>
            <FooterLinks links={marketplaceLinks} locale={locale} />
          </nav>

          <nav aria-label={translate(locale, "Help & orders", "المساعدة والطلبات")}>
            <ColumnTitle>{translate(locale, "Help & orders", "المساعدة والطلبات")}</ColumnTitle>
            <FooterLinks links={helpLinks} locale={locale} />
          </nav>

          <nav aria-label={translate(locale, "Information", "معلومات")}>
            <ColumnTitle>{translate(locale, "Information", "معلومات")}</ColumnTitle>
            <FooterLinks links={informationLinks} locale={locale} />
          </nav>
        </div>

        {/* ── وسائل الدفع ───────────────────────────────── */}
        <div className="mt-14 flex flex-col items-center gap-4 border-t border-white/[0.07] py-8 sm:flex-row sm:justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            <Icon name="lock" className="h-4 w-4" />
            {translate(locale, "Secure payment methods", "وسائل دفع آمنة")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {payments.map((p) => (
              <span
                key={p}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold tracking-wide text-white/70 transition hover:border-white/25 hover:text-white"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── الشريط السفلي ───────────────────────────────── */}
      <div className="relative border-t border-white/[0.07] bg-black/40">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 px-5 py-6 text-xs text-white/45 sm:flex-row sm:justify-between lg:px-10">
          <p className="order-2 sm:order-1">
            © {year} <span className="font-semibold text-white/70">Mtjr</span>.{" "}
            {translate(locale, "All rights reserved.", "جميع الحقوق محفوظة.")}
          </p>

          <div className="order-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:order-2">
            <Link href="/terms" className="transition hover:text-[var(--color-orange)]">
              {translate(locale, "Terms", "الشروط")}
            </Link>
            <Link href="/privacy" className="transition hover:text-[var(--color-orange)]">
              {translate(locale, "Privacy", "الخصوصية")}
            </Link>
            <Link href="/contact" className="transition hover:text-[var(--color-orange)]">
              {translate(locale, "Contact", "التواصل")}
            </Link>

            <span className="hidden h-4 w-px bg-white/15 sm:block" />

            <span className="inline-flex items-center gap-1.5 text-white/55">
              <Icon name="globe" className="h-3.5 w-3.5" />
              {translate(locale, "English", "العربية")}
            </span>

            <a
              href="#top"
              aria-label={translate(locale, "Back to top", "العودة للأعلى")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-white/60 transition hover:-translate-y-0.5 hover:border-[var(--color-orange)] hover:text-[var(--color-orange)]"
            >
              <Icon name="arrowUp" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}