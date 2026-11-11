import Link from "next/link";
import { translate, type Locale } from "@/lib/locale";

type FooterLink = { href: string; en: string; ar: string };

const groups: Array<{ titleEn: string; titleAr: string; links: FooterLink[] }> = [
  {
    titleEn: "Marketplace",
    titleAr: "السوق",
    links: [
      { href: "/products", en: "Shop products", ar: "تسوق المنتجات" },
      { href: "/categories", en: "Categories", ar: "الفئات" },
      { href: "/brands", en: "Brands", ar: "العلامات التجارية" },
      { href: "/stores", en: "Stores", ar: "المتاجر" },
      { href: "/seller", en: "Sell on Mtjr", ar: "بع على متجر" }
    ]
  },
  {
    titleEn: "Help & orders",
    titleAr: "المساعدة والطلبات",
    links: [
      { href: "/account/support", en: "Customer support", ar: "دعم العملاء" },
      { href: "/account/orders", en: "My orders", ar: "طلباتي" },
      { href: "/contact", en: "Contact us", ar: "اتصل بنا" }
    ]
  },
  {
    titleEn: "Information",
    titleAr: "معلومات",
    links: [
      { href: "/about", en: "About Mtjr", ar: "عن متجر" },
      { href: "/terms", en: "Terms of use", ar: "شروط الاستخدام" },
      { href: "/privacy", en: "Privacy notice", ar: "إشعار الخصوصية" }
    ]
  }
];

export default function SiteFooter({ locale, contactEmail }: { locale: Locale; contactEmail: string | null }) {
  const year = new Date().getFullYear();

  return (
    <footer dir={locale === "ar" ? "rtl" : "ltr"} className="relative mt-20 overflow-hidden border-t border-white/10 bg-[#30343d] text-white">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--color-orange)] to-transparent" />
      <div className="pointer-events-none absolute -top-32 start-1/4 h-72 w-72 rounded-full bg-[var(--color-orange)] opacity-[0.10] blur-[100px]" />
      <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-10">
        <section>
          <Link href="/" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-orange)]">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-orange)] to-amber-500 text-xl font-black text-[#17212b] shadow-lg">m</span>
            <span className="text-2xl font-black tracking-tight text-white">mtjr<span className="text-[var(--color-orange)]">.</span></span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">
            {translate(locale, "A multi-vendor marketplace bringing independent stores and shoppers together.", "سوق متعدد البائعين يجمع المتاجر المستقلة والمتسوقين في مكان واحد.")}
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{translate(locale, "Contact", "التواصل")}</p>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="mt-2 inline-block break-all text-sm font-medium text-white transition hover:text-[var(--color-orange)]">{contactEmail}</a>
            ) : (
              <Link href="/contact" className="mt-2 inline-block text-sm font-medium text-white transition hover:text-[var(--color-orange)]">{translate(locale, "Contact details", "بيانات التواصل")}</Link>
            )}
          </div>
        </section>

        {groups.map((group) => (
          <nav key={group.titleEn} aria-label={translate(locale, group.titleEn, group.titleAr)}>
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-white">
              <span className="h-4 w-[3px] rounded-full bg-[var(--color-orange)]" />
              {translate(locale, group.titleEn, group.titleAr)}
            </h2>
            <ul className="mt-5 space-y-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 transition hover:text-[var(--color-orange)]">
                    {translate(locale, link.en, link.ar)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>© {year} <span className="font-semibold text-white/75">Mtjr</span>. {translate(locale, "All rights reserved.", "جميع الحقوق محفوظة.")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/about" className="transition hover:text-[var(--color-orange)]">{translate(locale, "About", "من نحن")}</Link>
            <Link href="/terms" className="transition hover:text-[var(--color-orange)]">{translate(locale, "Terms", "الشروط")}</Link>
            <Link href="/privacy" className="transition hover:text-[var(--color-orange)]">{translate(locale, "Privacy", "الخصوصية")}</Link>
            <Link href="/contact" className="transition hover:text-[var(--color-orange)]">{translate(locale, "Contact", "التواصل")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
