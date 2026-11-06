import Link from "next/link";
import { translate, type Locale } from "@/lib/locale";

type FooterLink = { href: string; english: string; arabic: string };

const marketplaceLinks: FooterLink[] = [
  { href: "/products", english: "Shop all products", arabic: "تسوق جميع المنتجات" },
  { href: "/categories", english: "Categories", arabic: "الفئات" },
  { href: "/brands", english: "Brands", arabic: "العلامات التجارية" },
  { href: "/stores", english: "Stores", arabic: "المتاجر" },
  { href: "/seller", english: "Sell on Mtjr", arabic: "بع على متجر" }
];

const helpLinks: FooterLink[] = [
  { href: "/contact", english: "Contact us", arabic: "اتصل بنا" },
  { href: "/account/support", english: "Customer support", arabic: "دعم العملاء" },
  { href: "/account/orders", english: "My orders", arabic: "طلباتي" }
];

const informationLinks: FooterLink[] = [
  { href: "/about", english: "About Mtjr", arabic: "عن متجر" },
  { href: "/terms", english: "Terms of use", arabic: "شروط الاستخدام" },
  { href: "/privacy", english: "Privacy notice", arabic: "إشعار الخصوصية" }
];

function FooterLinks({ links, locale }: { links: FooterLink[]; locale: Locale }) {
  return (
    <ul className="mt-4 space-y-3">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="text-sm text-[var(--muted)] transition hover:text-[var(--color-orange)]"
          >
            {translate(locale, link.english, link.arabic)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function SiteFooter({
  locale,
  contactEmail
}: {
  locale: Locale;
  contactEmail: string | null;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <section>
          <Link href="/" className="text-2xl font-bold tracking-tight text-[var(--color-onyx)]">
            mtjr<span className="text-[var(--color-orange)]">.</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
            {translate(
              locale,
              "A global marketplace connecting shoppers with independent stores.",
              "سوق عالمي يربط المتسوقين بالمتاجر المستقلة."
            )}
          </p>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-onyx)]">
              {translate(locale, "Email", "البريد الإلكتروني")}
            </p>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="mt-1 inline-block break-all text-sm text-[var(--muted)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--color-orange)]"
              >
                {contactEmail}
              </a>
            ) : (
              <Link href="/contact" className="mt-1 inline-block text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--color-orange)]">
                {translate(locale, "Contact details", "بيانات التواصل")}
              </Link>
            )}
          </div>
        </section>

        <nav aria-label={translate(locale, "Marketplace", "السوق")}>
          <h2 className="text-sm font-bold text-[var(--color-onyx)]">
            {translate(locale, "Marketplace", "السوق")}
          </h2>
          <FooterLinks links={marketplaceLinks} locale={locale} />
        </nav>

        <nav aria-label={translate(locale, "Help", "المساعدة")}>
          <h2 className="text-sm font-bold text-[var(--color-onyx)]">
            {translate(locale, "Help & orders", "المساعدة والطلبات")}
          </h2>
          <FooterLinks links={helpLinks} locale={locale} />
        </nav>

        <nav aria-label={translate(locale, "Information", "معلومات")}>
          <h2 className="text-sm font-bold text-[var(--color-onyx)]">
            {translate(locale, "Information", "معلومات")}
          </h2>
          <FooterLinks links={informationLinks} locale={locale} />
        </nav>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>© {year} Mtjr. {translate(locale, "All rights reserved.", "جميع الحقوق محفوظة.")}</p>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-[var(--color-orange)]">{translate(locale, "Terms", "الشروط")}</Link>
            <Link href="/privacy" className="hover:text-[var(--color-orange)]">{translate(locale, "Privacy", "الخصوصية")}</Link>
            <Link href="/contact" className="hover:text-[var(--color-orange)]">{translate(locale, "Contact", "التواصل")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
