"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type VerificationState = "checking" | "verified" | "invalid" | "missing";

export default function VerifyEmailPage({ initialToken = "", initialEmail = "" }: { initialToken?: string; initialEmail?: string }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [state, setState] = useState<VerificationState>(initialToken ? "checking" : "missing");
  const [email, setEmail] = useState(initialEmail);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialToken) return;
    let active = true;
    const params = new URLSearchParams(window.location.search);
    params.delete("token");
    const query = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
    void fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: initialToken }),
      cache: "no-store"
    }).then(async (response) => {
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Verification failed.");
      if (active) setState("verified");
    }).catch((cause: unknown) => {
      if (active) {
        setState("invalid");
        setError(cause instanceof Error ? cause.message : "Verification failed.");
      }
    });
    return () => { active = false; };
  }, [initialToken]);

  async function resend() {
    if (!email.trim() || resending) return;
    setResending(true);
    setError("");
    setResendNotice("");
    try {
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store"
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to request a verification email.");
      setResendNotice(result.message || "If the account is eligible, a verification email will be sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request a verification email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-white p-7 shadow-[var(--shadow-card)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Matjar · Account security</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-forest-950)]">{t("Verify your email", "تحقق من بريدك الإلكتروني")}</h1>
        {state === "checking" && <p role="status" className="mt-5 text-sm text-[var(--muted)]">{t("Checking your verification link…", "جارٍ التحقق من رابط البريد…")}</p>}
        {state === "verified" && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">{t("Your email is verified.", "تم التحقق من بريدك الإلكتروني.")}</p><p className="mt-1">{t("You can now sign in securely.", "يمكنك الآن تسجيل الدخول بأمان.")}</p><Link href="/login" className="mt-4 inline-flex rounded-lg bg-[var(--color-forest-900)] px-4 py-2 font-semibold text-white">{t("Continue to sign in", "المتابعة إلى تسجيل الدخول")}</Link></div>}
        {state !== "verified" && state !== "checking" && <div className="mt-5 space-y-4">
          {state === "invalid" && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t("This link is invalid, expired, or already used. Request a new verification email below.", "هذا الرابط غير صالح أو منتهي الصلاحية أو سبق استخدامه. اطلب رسالة تحقق جديدة أدناه.")}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <label className="block text-sm font-medium text-[var(--foreground)]">{t("Email address", "البريد الإلكتروني")}<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm" /></label>
          <button type="button" onClick={() => void resend()} disabled={resending || !email.trim()} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{resending ? t("Sending…", "جارٍ الإرسال…") : t("Resend verification email", "إعادة إرسال رسالة التحقق")}</button>
          {resendNotice && <p role="status" className="rounded-xl border border-[var(--border)] bg-[var(--color-ivory-100)] p-3 text-sm text-[var(--foreground)]">{resendNotice}</p>}
          <p className="text-sm text-[var(--muted)]"><Link href="/login" className="font-semibold text-[var(--color-copper-600)] hover:underline">{t("Return to sign in", "العودة إلى تسجيل الدخول")}</Link></p>
        </div>}
      </section>
    </main>
  );
}
