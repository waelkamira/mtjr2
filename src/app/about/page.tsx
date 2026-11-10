import type { Metadata } from "next";
import Link from "next/link";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return { title: translate(locale, "About Mtjr", "عن متجر") };
}

export default async function AboutPage() {
  const locale = await getPreferredLocale();

  return (
    <main className="min-h-[60vh] px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-orange)]">
          {translate(locale, "About us", "من نحن")}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-onyx)]">
          {translate(locale, "A marketplace built around choice", "سوق يمنحك خيارات أوسع")}
        </h1>
        <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
          {translate(
            locale,
            "Mtjr is a multi-vendor marketplace designed to help people discover products from independent stores in one place. We’re building tools that make browsing, buying, and selling clear and convenient.",
            "متجر سوق متعدد البائعين يهدف إلى مساعدة الناس على اكتشاف منتجات المتاجر المستقلة في مكان واحد. نطوّر أدوات تجعل التصفح والشراء والبيع أكثر وضوحًا وسهولة."
          )}
        </p>
        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm leading-6 text-[var(--muted)]">
          {translate(
            locale,
            "The platform and its services are still being developed. Availability of products, markets, payments, shipping, and support features may vary.",
            "لا تزال المنصة وخدماتها قيد التطوير. قد يختلف توفر المنتجات والأسواق ووسائل الدفع والشحن وميزات الدعم."
          )}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/products" className="inline-flex rounded-xl bg-[var(--color-orange)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-clay)] hover:opacity-90">
            {translate(locale, "Explore the marketplace", "استكشف السوق")}
          </Link>
          <Link href="/contact" className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-onyx)] hover:bg-[var(--background)]">
            {translate(locale, "Contact us", "اتصل بنا")}
          </Link>
        </div>
      </article>
    </main>
  );
}
