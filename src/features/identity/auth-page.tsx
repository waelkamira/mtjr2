"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthReturnLink from "@/components/auth-return-link";
import { currentReturnPath } from "@/lib/current-return-path";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type AuthMode = "login" | "forgot" | "reset";

type ApiResult = {
  message?: string;
  error?: string;
  code?: string;
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
};

async function postJson(path: string, payload: unknown, t: (english: string, arabic: string) => string): Promise<ApiResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  let result: ApiResult;
  try { result = await response.json() as ApiResult; }
  catch { throw new Error(t("The server returned an unreadable response. Please try again.", "أعاد الخادم استجابة غير مقروءة. حاول مجددًا.")); }
  if (!response.ok) {
    const loginErrors: Record<string, string> = {
      EMAIL_NOT_FOUND: t("No account was found with that email address.", "لم نعثر على حساب بهذا البريد الإلكتروني."),
      EMAIL_NOT_VERIFIED: t("Verify your email address before signing in.", "تحقق من بريدك الإلكتروني قبل تسجيل الدخول."),
      INVALID_PASSWORD: t("The password is incorrect.", "كلمة المرور غير صحيحة."),
      INVALID_CREDENTIALS: t("Email or password is incorrect.", "البريد الإلكتروني أو كلمة المرور غير صحيحين."),
      RATE_LIMITED: t("Too many attempts. Try again later.", "محاولات كثيرة. حاول مرة أخرى لاحقًا.")
    };
    throw new Error((result.code && loginErrors[result.code]) || result.error || result.message || t("The request could not be completed.", "تعذّر إكمال الطلب."));
  }
  return result;
}

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-copper-500)]";
const buttonClass = "inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-forest-900)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-800)] disabled:cursor-not-allowed disabled:opacity-55";

export default function AuthPage({ mode, initialToken = "", initialEmail = "", initialOAuthError = "", initialMfaRequired = false }: { mode: AuthMode; initialToken?: string; initialEmail?: string; initialOAuthError?: string; initialMfaRequired?: boolean }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const localizeOAuthError = (message: string) => ({
    "Google sign-in is not configured in this environment yet.": t("Google sign-in is not configured in this environment yet.", "تسجيل الدخول باستخدام Google غير مُعدّ في هذه البيئة بعد."),
    "Google sign-in could not be verified. Please try again.": t("Google sign-in could not be verified. Please try again.", "تعذّر التحقق من تسجيل الدخول باستخدام Google. حاول مجددًا."),
    "Google sign-in failed. Please try again or use your email and password.": t("Google sign-in failed. Please try again or use your email and password.", "فشل تسجيل الدخول باستخدام Google. حاول مجددًا أو استخدم بريدك الإلكتروني وكلمة المرور."),
    "This Google account is not active. Contact support.": t("This Google account is not active. Contact support.", "حساب Google هذا غير نشط. تواصل مع الدعم."),
    "This email already has a password account. Sign in with your password; accounts are not linked automatically.": t("This email already has a password account. Sign in with your password; accounts are not linked automatically.", "لديك حساب يستخدم كلمة مرور بهذا البريد. سجّل الدخول بكلمة مرورك؛ لا يتم ربط الحسابات تلقائيًا."),
    "No Mtjr2 account is linked to that Google account. Create an account first.": t("No Mtjr2 account is linked to that Google account. Create an account first.", "لا يوجد حساب Mtjr2 مرتبط بحساب Google هذا. أنشئ حسابًا أولًا."),
    "Google sign-in could not be completed.": t("Google sign-in could not be completed.", "تعذّر إكمال تسجيل الدخول باستخدام Google.")
  } as Record<string, string>)[message] ?? message;
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState(initialMfaRequired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialOAuthError);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      params.delete("token");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
    }
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const returnTo = mode === "login" ? currentReturnPath() : "/";
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "login") {
        if (mfaChallenge) {
          await postJson("/api/account/security/mfa", { action: "verify", code: mfaCode }, t);
          setMfaCode("");
          window.location.replace(returnTo);
          return;
        }
        const result = await postJson("/api/auth/login", { email, password }, t);
        setPassword("");
        if (result.mfaRequired) {
          setMfaChallenge(true);
          setNotice(t("Enter a code from your authenticator app or use a recovery code.", "أدخل رمزًا من تطبيق المصادقة أو استخدم رمز استرداد."));
          return;
        }
        if (result.mfaSetupRequired) {
          const params = new URLSearchParams({
            mfa: "setup",
            returnTo
          });
          router.replace(`/account/security?${params.toString()}`);
          return;
        }
        setNotice(result.message || t("Signed in. Redirecting…", "تم تسجيل الدخول. جارٍ إعادة التوجيه…"));
        window.location.replace(returnTo);
      } else if (mode === "forgot") {
        const result = await postJson("/api/auth/password-reset/request", { email }, t);
        setNotice(result.message || t("If an eligible account exists, reset instructions will be sent.", "إذا كان هناك حساب مؤهل، فستُرسل إليه تعليمات إعادة التعيين."));
      } else if (mode === "reset") {
        const result = await postJson("/api/auth/password-reset/complete", { token, password }, t);
        setNotice(result.message || t("Password updated. You can now sign in.", "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن."));
        setPassword("");
      }
    } catch (cause) {
      if (mode === "login" && cause instanceof Error && cause.message === t("Verify your email address before signing in.", "تحقق من بريدك الإلكتروني قبل تسجيل الدخول.")) {
        window.location.assign(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setError(cause instanceof Error ? cause.message : t("The request could not be completed.", "تعذّر إكمال الطلب."));
    } finally { setBusy(false); }
  }

  function continueWithGoogle() {
    const params = new URLSearchParams({
      intent: "login",
      returnTo: currentReturnPath()
    });
    // OAuth start must follow the server's external redirect as a document navigation.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
  }

  const title = {
    login: t("Welcome back", "مرحبًا بعودتك"),
    forgot: t("Reset your password", "إعادة تعيين كلمة المرور"),
    reset: t("Choose a new password", "اختر كلمة مرور جديدة")
  }[mode];
  const description = {
    login: t("Sign in to continue to your marketplace account.", "سجّل الدخول للمتابعة إلى حسابك في السوق."),
    forgot: t("Enter your email and we’ll send instructions if an eligible account exists.", "أدخل بريدك الإلكتروني وسنرسل التعليمات إذا كان هناك حساب مؤهل."),
    reset: t("Choose a new password. Your other active sessions will be signed out.", "اختر كلمة مرور جديدة. سيتم تسجيل الخروج من جلساتك النشطة الأخرى.")
  }[mode];

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">{t("Back to marketplace", "العودة إلى السوق")}</Link>
        </header>
        <div className="clay-surface grid overflow-hidden rounded-[2rem] border-white/80 bg-[var(--surface)] lg:min-h-[650px] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden overflow-hidden bg-[var(--color-lavender-100)] p-10 text-[var(--color-lavender-950)] lg:flex lg:flex-col lg:justify-between xl:p-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(190,130,87,.35),transparent_42%),linear-gradient(145deg,transparent,rgba(0,0,0,.2))]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[.24em] text-[var(--color-lavender-600)]">{t("Mtjr2 marketplace", "سوق متجر ٢")}</p>
              <h2 className="mt-8 max-w-md text-4xl font-semibold leading-tight xl:text-5xl">{mode === "login" ? t("Your marketplace. One secure account.", "سوقك. حساب آمن واحد.") : t("Your account, protected at every step.", "حسابك محمي في كل خطوة.")}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-[var(--color-lavender-800)]/80">{mode === "login" ? t("Discover products, manage orders, save favorites and connect with trusted stores.", "اكتشف المنتجات وأدر الطلبات واحفظ المفضلة وتواصل مع المتاجر الموثوقة.") : t("Protect your sessions and keep account recovery simple.", "احمِ جلساتك واجعل استعادة الحساب سهلة.")}</p>
            </div>
            <div className="relative space-y-4 text-sm text-white/80">
              <p>{t("01 · One account for shopping and selling", "٠١ · حساب واحد للتسوق والبيع")}</p>
              <p>{t("02 · Secure sessions and account recovery", "٠٢ · جلسات آمنة واستعادة الحساب")}</p>
              <p>{t("03 · Seller access after marketplace review", "٠٣ · صلاحية البيع بعد مراجعة السوق")}</p>
            </div>
          </aside>
          <section className="w-full px-6 py-8 sm:px-9 lg:px-12 xl:px-14">
            <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Mtjr2 account", "حساب متجر ٢")}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
          {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{localizeOAuthError(error)}</p>}
          {notice && <p role="status" className="mt-6 rounded-xl border border-[var(--color-sage-200)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-900)]">{notice}</p>}

          <form onSubmit={submit} className="mt-7 space-y-5">
              {mode !== "reset" && !(mode === "login" && mfaChallenge) && <label className="block text-sm font-medium">{t("Email address", "البريد الإلكتروني")}
                <input className={fieldClass} type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
              </label>}
              {(mode === "login" || mode === "reset") && !(mode === "login" && mfaChallenge) && <label className="block text-sm font-medium">{mode === "reset" ? t("New password", "كلمة المرور الجديدة") : t("Password", "كلمة المرور")}
                <input className={fieldClass} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === "login" ? 1 : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                {mode !== "login" && <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{t("Use 12–128 characters.", "استخدم من ١٢ إلى ١٢٨ حرفًا.")}</span>}
              </label>}
              {mode === "login" && mfaChallenge && <label className="block text-sm font-medium">{t("Authenticator or recovery code", "رمز المصادقة أو الاسترداد")}
                <input className={fieldClass} value={mfaCode} onChange={event => setMfaCode(event.target.value)} required maxLength={32} autoComplete="one-time-code" />
              </label>}
              {mode === "reset" && <label className="block text-sm font-medium">{t("Reset token", "رمز إعادة التعيين")}
                <input className={fieldClass} value={token} onChange={e => setToken(e.target.value)} required minLength={43} maxLength={43} autoComplete="one-time-code" />
              </label>}
              <button className={buttonClass} disabled={busy || (mode === "reset" && token.length !== 43)}>{busy ? t("Please wait…", "يرجى الانتظار…") : mode === "login" ? mfaChallenge ? t("Verify and continue", "تحقق وتابع") : t("Sign in", "تسجيل الدخول") : mode === "forgot" ? t("Send reset instructions", "إرسال تعليمات إعادة التعيين") : t("Update password", "تحديث كلمة المرور")}</button>
          </form>

          {mode === "login" && !mfaChallenge && (
            <div className="mt-5">
              <div className="mb-4 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--border)]" />{t("OR", "أو")}<span className="h-px flex-1 bg-[var(--border)]" /></div>
              <button type="button" className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--color-forest-900)] transition hover:bg-[var(--color-ivory-100)] disabled:opacity-55" onClick={continueWithGoogle} disabled={busy}>
                <span aria-hidden="true" className="text-base font-bold">G</span>{t("Continue with Google", "المتابعة باستخدام Google")}
              </button>
            </div>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm">
            {mode === "login" && <><Link className="font-medium text-[var(--color-forest-800)] hover:underline" href="/forgot-password">{t("Forgot password?", "هل نسيت كلمة المرور؟")}</Link><AuthReturnLink className="font-medium text-[var(--color-forest-800)] hover:underline" href="/register">{t("Create account", "إنشاء حساب")}</AuthReturnLink></>}
            {(mode === "forgot" || mode === "reset") && <Link className="font-semibold text-[var(--color-forest-800)] hover:underline" href="/login">{t("Back to sign in", "العودة إلى تسجيل الدخول")}</Link>}
          </div>
          </div>
          </section>
        </div>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">{t("Secure account access · Your password is never sent by email.", "دخول آمن إلى الحساب · لن تُرسل كلمة مرورك عبر البريد الإلكتروني.")}</p>
      </div>
    </main>
  );
}
