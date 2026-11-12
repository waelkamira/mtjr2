"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { safeReturnPath } from "@/lib/safe-return-path";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-lavender-600)]";
const mfaButtonClass = "rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";

export default function SecurityPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mfaStatus, setMfaStatus] = useState<{
    enabled: boolean;
    required: boolean;
    platformRequired: boolean;
    privilegedAccountRequired: boolean;
    enrollmentRequired: boolean;
    verified: boolean;
  } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [mfaNotice, setMfaNotice] = useState("");
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [mfaReturnTo] = useState(() => {
    if (typeof window === "undefined") return "/account/security";
    const params = new URLSearchParams(window.location.search);
    const requestedAction = params.get("mfa");
    if (requestedAction !== "setup" && requestedAction !== "verify") {
      return "/account/security";
    }
    return safeReturnPath(params.get("returnTo"), window.location.origin, "/account");
  });

  useEffect(() => {
    fetch("/api/account/security/mfa", { cache: "no-store" })
      .then(async response => {
        const result = await response.json() as typeof mfaStatus & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Unable to load multi-factor status.", "تعذّر تحميل حالة المصادقة متعددة العوامل."));
        setMfaStatus(result);
      })
      .catch(cause => setMfaError(cause instanceof Error ? cause.message : translate(locale, "Unable to load multi-factor status.", "تعذّر تحميل حالة المصادقة متعددة العوامل.")))
      .finally(() => setMfaLoading(false));
  }, [locale]);

  async function submitMfa(action: "setup" | "confirm" | "verify" | "disable") {
    if (mfaBusy) return;
    setMfaBusy(true);
    setMfaError("");
    setMfaNotice("");
    try {
      const body = action === "setup"
        ? { action, currentPassword: mfaPassword }
        : action === "disable"
          ? { action, currentPassword: mfaPassword, code: mfaCode }
          : { action, code: mfaCode };
      const response = await fetch("/api/account/security/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store"
      });
      const result = await response.json() as {
        error?: string;
        secret?: string;
        otpauthUri?: string;
        recoveryCodes?: string[];
        enabled?: boolean;
        verified?: boolean;
      };
      if (!response.ok) throw new Error(result.error || t("Unable to update multi-factor authentication.", "تعذّر تحديث المصادقة متعددة العوامل."));

      if (action === "setup" && result.secret && result.otpauthUri) {
        setMfaSetup({ secret: result.secret, otpauthUri: result.otpauthUri });
        setMfaPassword("");
      } else if (action === "confirm" && result.recoveryCodes) {
        setRecoveryCodes(result.recoveryCodes);
        setMfaSetup(null);
        setMfaCode("");
        setMfaStatus({
          enabled: true,
          required: true,
          platformRequired: Boolean(mfaStatus?.platformRequired),
          privilegedAccountRequired: Boolean(mfaStatus?.privilegedAccountRequired),
          enrollmentRequired: false,
          verified: true
        });
        setMfaNotice(t("Multi-factor authentication is enabled. Save these recovery codes before continuing.", "تم تفعيل المصادقة متعددة العوامل. احفظ رموز الاسترداد هذه قبل المتابعة."));
      } else if (action === "verify") {
        setMfaCode("");
        setMfaStatus(current => current ? { ...current, verified: true } : current);
        router.replace(mfaReturnTo);
      } else if (action === "disable") {
        setMfaCode("");
        setMfaPassword("");
        setRecoveryCodes([]);
        setMfaStatus(current => current ? { ...current, enabled: false, required: false, verified: false } : current);
        setMfaNotice(t("Multi-factor authentication has been disabled.", "تم إيقاف المصادقة متعددة العوامل."));
      }
    } catch (cause) {
      setMfaError(cause instanceof Error ? cause.message : t("Unable to update multi-factor authentication.", "تعذّر تحديث المصادقة متعددة العوامل."));
    } finally {
      setMfaBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        cache: "no-store"
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || t("Unable to update your password.", "تعذّر تحديث كلمة المرور."));
      setCurrentPassword("");
      setNewPassword("");
      setNotice(result.message || t("Password updated.", "تم تحديث كلمة المرور."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to update your password.", "تعذّر تحديث كلمة المرور."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/account" className="text-sm text-[var(--color-ink-600)]">← {t("My account", "حسابي")}</Link>
        <h1 className="mt-5 text-3xl font-semibold">{t("Security", "الأمان")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("Protect your account and review signed-in devices.", "احمِ حسابك وراجع الأجهزة المسجّلة الدخول.")}</p>
        <div className="mt-7 space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">{t("Change password", "تغيير كلمة المرور")}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("Confirm your current password. Other active sessions and password-reset links will be revoked.", "أكّد كلمة مرورك الحالية. سيتم إنهاء الجلسات النشطة الأخرى وإبطال روابط إعادة تعيين كلمة المرور.")}</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
            <form onSubmit={changePassword} className="mt-4 space-y-4">
              <label className="block text-sm font-medium">{t("Current password", "كلمة المرور الحالية")}
                <input className={fieldClass} type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required maxLength={128} />
              </label>
              <label className="block text-sm font-medium">{t("New password", "كلمة المرور الجديدة")}
                <input className={fieldClass} type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required minLength={12} maxLength={128} />
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{t("Use 12–128 characters.", "استخدم من ١٢ إلى ١٢٨ حرفًا.")}</span>
              </label>
              <button disabled={busy} className="rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? t("Updating…", "جارٍ التحديث…") : t("Update password", "تحديث كلمة المرور")}
              </button>
            </form>
            <p className="mt-4 text-sm text-[var(--muted)]">{t("Forgot your current password?", "هل نسيت كلمة مرورك الحالية؟")} <Link href="/forgot-password" className="font-semibold text-[var(--color-ink-600)]">{t("Reset it by email", "أعد تعيينها عبر البريد الإلكتروني")}</Link>.</p>
          </section>
          <Link href="/account/sessions" className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <b>{t("Active sessions", "الجلسات النشطة")}</b>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("Review and revoke sessions on devices you no longer use.", "راجع الجلسات على الأجهزة التي لم تعد تستخدمها وأنهِها.")}</p>
          </Link>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">{t("Multi-factor authentication", "المصادقة متعددة العوامل")}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("Use an authenticator app and one-time recovery codes to protect your account.", "استخدم تطبيق مصادقة ورموز استرداد لمرة واحدة لحماية حسابك.")}</p>
            {mfaStatus?.privilegedAccountRequired && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("Multi-factor authentication is required for administrator and seller access.", "المصادقة متعددة العوامل مطلوبة للوصول بصلاحيات المسؤول والبائع.")}</p>}
            {mfaError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{mfaError}</p>}
            {mfaNotice && <p role="status" className="mt-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{mfaNotice}</p>}
            {mfaLoading && <p className="mt-4 text-sm text-[var(--muted)]">{t("Loading security status…", "جارٍ تحميل حالة الأمان…")}</p>}
            {!mfaLoading && !mfaStatus?.enabled && !mfaSetup && (
              <form onSubmit={event => { event.preventDefault(); void submitMfa("setup"); }} className="mt-4 space-y-4">
                <label className="block text-sm font-medium">{t("Confirm your password to set up", "أكّد كلمة مرورك للإعداد")}
                  <input className={fieldClass} type="password" autoComplete="current-password" value={mfaPassword} onChange={event => setMfaPassword(event.target.value)} required maxLength={128} />
                </label>
                <button disabled={mfaBusy} className={mfaButtonClass}>{mfaBusy ? t("Please wait…", "يرجى الانتظار…") : t("Set up authenticator", "إعداد تطبيق المصادقة")}</button>
              </form>
            )}
            {mfaSetup && (
              <div className="mt-4 space-y-4">
                <p className="text-sm">{t("Add this secret to your authenticator app:", "أضف هذا المفتاح السري إلى تطبيق المصادقة:")}</p>
                <code className="block break-all rounded-xl bg-[var(--background)] p-3 text-sm">{mfaSetup.secret}</code>
                <p className="text-xs leading-5 text-[var(--muted)]">{t("Use a time-based code (TOTP) with 6 digits and a 30-second period. If you already added this account, replace its saved secret with the one shown here. Make sure your device date and time are set automatically.", "استخدم رمزًا زمنيًا (TOTP) من ٦ أرقام بفترة ٣٠ ثانية. إذا سبق أن أضفت هذا الحساب، فاستبدل المفتاح المحفوظ بالمفتاح الظاهر هنا. تأكد من ضبط تاريخ جهازك ووقته تلقائيًا.")}</p>
                <details>
                  <summary className="cursor-pointer text-sm font-medium">{t("Manual setup URI", "رابط الإعداد اليدوي")}</summary>
                  <code className="mt-2 block break-all rounded-xl bg-[var(--background)] p-3 text-xs">{mfaSetup.otpauthUri}</code>
                </details>
                <form onSubmit={event => { event.preventDefault(); void submitMfa("confirm"); }} className="space-y-4">
                  <label className="block text-sm font-medium">{t("Enter the 6-digit code from your authenticator", "أدخل الرمز المكوّن من ٦ أرقام من تطبيق المصادقة")}
                    <input className={fieldClass} inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value)} required maxLength={6} />
                  </label>
                  <button disabled={mfaBusy} className={mfaButtonClass}>{mfaBusy ? t("Please wait…", "يرجى الانتظار…") : t("Confirm setup", "تأكيد الإعداد")}</button>
                </form>
              </div>
            )}
            {!mfaLoading && mfaStatus?.enabled && !mfaStatus.verified && !recoveryCodes.length && (
              <form onSubmit={event => { event.preventDefault(); void submitMfa("verify"); }} className="mt-4 space-y-4">
                <label className="block text-sm font-medium">{t("Authenticator or recovery code", "رمز المصادقة أو الاسترداد")}
                  <input className={fieldClass} autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value)} required maxLength={32} />
                </label>
                <button disabled={mfaBusy} className={mfaButtonClass}>{mfaBusy ? t("Please wait…", "يرجى الانتظار…") : t("Verify and continue", "تحقق وتابع")}</button>
              </form>
            )}
            {mfaStatus?.enabled && mfaStatus.verified && !recoveryCodes.length && <p className="mt-4 text-sm font-medium text-emerald-800">{t("Authenticator protection is enabled.", "حماية تطبيق المصادقة مفعّلة.")}</p>}
            {recoveryCodes.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">{t("Save these recovery codes now. Each code works once; they cannot be shown again.", "احفظ رموز الاسترداد الآن. يُستخدم كل رمز مرة واحدة ولا يمكن عرضها مجددًا.")}</p>
                <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
                  {recoveryCodes.map(code => <li key={code}>{code}</li>)}
                </ul>
                <button type="button" className={`${mfaButtonClass} mt-4`} onClick={() => { setRecoveryCodes([]); setMfaNotice(""); router.replace(mfaReturnTo); }}>
                  {t("I saved my codes", "حفظت الرموز")}
                </button>
              </div>
            )}
            {mfaStatus?.enabled && !mfaStatus.privilegedAccountRequired && (
              <form onSubmit={event => { event.preventDefault(); void submitMfa("disable"); }} className="mt-5 space-y-4 border-t border-[var(--border)] pt-4">
                <p className="text-sm text-[var(--muted)]">{t("To disable this optional protection, confirm your password and a current authenticator or unused recovery code.", "لإيقاف هذه الحماية الاختيارية، أكّد كلمة مرورك ورمزًا حاليًا من تطبيق المصادقة أو رمز استرداد غير مستخدم.")}</p>
                <label className="block text-sm font-medium">{t("Current password", "كلمة المرور الحالية")}
                  <input className={fieldClass} type="password" autoComplete="current-password" value={mfaPassword} onChange={event => setMfaPassword(event.target.value)} required maxLength={128} />
                </label>
                <label className="block text-sm font-medium">{t("Authenticator or recovery code", "رمز المصادقة أو الاسترداد")}
                  <input className={fieldClass} value={mfaCode} onChange={event => setMfaCode(event.target.value)} required maxLength={32} />
                </label>
                <button disabled={mfaBusy} className={mfaButtonClass}>{mfaBusy ? t("Please wait…", "يرجى الانتظار…") : t("Disable multi-factor authentication", "إيقاف المصادقة متعددة العوامل")}</button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
