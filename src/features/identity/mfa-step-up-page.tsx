"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { safeReturnPath } from "@/lib/safe-return-path";

export default function MfaStepUpPage({ overlay = false }: { overlay?: boolean }) {
  const { locale } = useLocale();
  const t = (en: string, ar: string) => translate(locale, en, ar);
  const router = useRouter();
  const pathname = usePathname();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const returnTo = typeof window === "undefined" ? "/admin/control-panel" : safeReturnPath(new URLSearchParams(window.location.search).get("returnTo") || (overlay ? pathname : null), window.location.origin, "/admin/control-panel");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/step-up", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }), cache: "no-store"
      });
      const result = await response.json() as { error?: string; verified?: boolean };
      if (!response.ok || !result.verified) throw new Error(result.error || t("Verification failed.", "فشل التحقق."));
      if (!overlay) router.replace(returnTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to verify your authenticator code.", "تعذّر التحقق من رمز المصادقة."));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return <main className={overlay ? "fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950/75 px-3 py-6 backdrop-blur-sm sm:px-5 sm:py-10" : "min-h-screen bg-[var(--background)] px-3 py-6 sm:px-5 sm:py-10"}><section className="mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-copper-600)]">{t("Protected platform action", "إجراء محمي للمنصة")}</p><h1 className="mt-3 text-2xl font-bold">{t("Verify it’s you", "تحقق من هويتك")}</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("Enter a fresh six-digit code from your authenticator app. This verification protects platform administration across the marketplace for ten minutes.", "أدخل رمزاً جديداً من ستة أرقام من تطبيق المصادقة. يحمي هذا التحقق إدارة المنصة في جميع أقسام السوق لمدة عشر دقائق.")}</p>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium">{t("Authenticator code", "رمز تطبيق المصادقة")}<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-2xl tracking-[.35em] text-[var(--foreground)]" /></label><button disabled={busy || code.length !== 6} className="w-full rounded-md bg-[#FF8C1C] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Verifying…", "جارٍ التحقق…") : t("Verify and continue", "تحقق وتابع")}</button></form></section></main>;
}
