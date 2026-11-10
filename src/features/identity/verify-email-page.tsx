"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function VerifyEmailPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-white p-7 shadow-[var(--shadow-card)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Matjar · Account access</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-forest-950)]">{t("Email verification is not required", "تأكيد البريد الإلكتروني غير مطلوب")}</h1>
        <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{t("You can sign in to your account without confirming your email address.", "يمكنك تسجيل الدخول إلى حسابك دون الحاجة إلى تأكيد بريدك الإلكتروني.")}</p>
        <Link href="/login" className="mt-6 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">{t("Continue to sign in", "المتابعة إلى تسجيل الدخول")}</Link>
      </section>
    </main>
  );
}
