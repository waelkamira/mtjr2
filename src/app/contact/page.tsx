import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import { translate } from "@/lib/locale";
import { getPreferredLocale } from "@/server/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return { title: translate(locale, "Contact Mtjr", "تواصل مع متجر") };
}

export default async function ContactPage() {
  const locale = await getPreferredLocale();
  const contactEmail = env.CONTACT_EMAIL ?? env.RESEND_FROM_EMAIL;

  return (
    <main className="min-h-[60vh] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-orange)]">
          {translate(locale, "We’re here to help", "نسعد بمساعدتك")}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-onyx)]">
          {translate(locale, "Contact Mtjr", "تواصل مع متجر")}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          {translate(
            locale,
            "For questions about your account, orders, or using the marketplace, choose the contact option that works best for you.",
            "للاستفسارات حول حسابك أو طلباتك أو استخدام السوق، اختر وسيلة التواصل المناسبة لك."
          )}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-[var(--border)] p-5">
            <h2 className="font-semibold text-[var(--color-onyx)]">
              {translate(locale, "Email", "البريد الإلكتروني")}
            </h2>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="mt-2 inline-block break-all text-sm font-medium text-[var(--color-orange)] underline underline-offset-4">
                {contactEmail}
              </a>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {translate(
                  locale,
                  "Email contact is not configured yet. Please use the support center.",
                  "لم يتم إعداد بريد التواصل بعد. يرجى استخدام مركز الدعم."
                )}
              </p>
            )}
          </article>
          <article className="rounded-2xl border border-[var(--border)] p-5">
            <h2 className="font-semibold text-[var(--color-onyx)]">
              {translate(locale, "Account support", "دعم الحساب")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {translate(
                locale,
                "For a private request about your account or an order, visit the support center.",
                "لإرسال طلب خاص بحسابك أو بطلب، تفضل بزيارة مركز الدعم."
              )}
            </p>
            <Link href="/account/support" className="mt-4 inline-flex rounded-xl bg-[var(--color-orange)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-clay)] hover:opacity-90">
              {translate(locale, "Go to support center", "انتقل إلى مركز الدعم")}
            </Link>
          </article>
        </div>

        <p className="mt-8 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
          {translate(locale, "Learn more about Mtjr:", "تعرف على المزيد عن متجر:")}{" "}
          <Link href="/about" className="font-semibold text-[var(--color-orange)] underline underline-offset-4">
            {translate(locale, "About us", "من نحن")}
          </Link>
        </p>
      </section>
    </main>
  );
}
