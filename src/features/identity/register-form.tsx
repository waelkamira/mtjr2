"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthReturnLink from "@/components/auth-return-link";
import { currentReturnPath } from "@/lib/current-return-path";
import RegistrationTurnstile from "@/features/identity/registration-turnstile";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-copper-500)]";
const buttonClass = "inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-forest-900)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-800)] disabled:cursor-not-allowed disabled:opacity-55";

export default function RegisterForm({ initialOAuthError = "", turnstileSiteKey, registrationAvailable = true }: { initialOAuthError?: string; turnstileSiteKey: string; registrationAvailable?: boolean }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const localizeOAuthError = (message: string) => {
    const messages: Record<string, string> = {
      "Google sign-in is not configured in this environment yet.": t("Google sign-in is not configured in this environment yet.", "تسجيل الدخول باستخدام Google غير مُعدّ في هذه البيئة بعد."),
      "New account registration is currently unavailable.": t("New account registration is currently unavailable.", "تسجيل الحسابات الجديدة غير متاح حاليًا."),
      "Please complete the bot check before continuing with Google.": t("Please complete the bot check before continuing with Google.", "أكمل التحقق من الروبوت قبل المتابعة باستخدام Google."),
      "Google sign-in could not be verified. Please try again.": t("Google sign-in could not be verified. Please try again.", "تعذّر التحقق من تسجيل الدخول باستخدام Google. حاول مجددًا."),
      "Google sign-in failed. Please try again or use email and password.": t("Google sign-in failed. Please try again or use email and password.", "فشل تسجيل الدخول باستخدام Google. حاول مجددًا أو استخدم بريدك الإلكتروني وكلمة المرور."),
      "This Google account is not active. Contact support.": t("This Google account is not active. Contact support.", "حساب Google هذا غير نشط. تواصل مع الدعم."),
      "An account with this email already exists. Sign in with your existing method; accounts are not linked automatically.": t("An account with this email already exists. Sign in with your existing method; accounts are not linked automatically.", "يوجد حساب بهذا البريد بالفعل. سجّل الدخول بالطريقة المعتادة؛ لا يتم ربط الحسابات تلقائيًا."),
      "Google sign-in could not be completed.": t("Google sign-in could not be completed.", "تعذّر إكمال تسجيل الدخول باستخدام Google.")
    };
    return messages[message] ?? message;
  };
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"CUSTOMER" | "SELLER">("CUSTOMER");
  const [sellerLegalName, setSellerLegalName] = useState("");
  const [sellerDisplayName, setSellerDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetVersion, setTurnstileResetVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [oauthError, setOauthError] = useState(initialOAuthError);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [deliveryUnavailable, setDeliveryUnavailable] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");

  async function continueWithGoogle() {
    if (!acceptedTerms || !acceptedPrivacy) { setOauthError(t("Please accept both policy documents before continuing.", "اقبل وثيقتي السياسات قبل المتابعة.")); return; }
    if (accountType === "SELLER" && (!sellerLegalName.trim() || !sellerDisplayName.trim())) { setOauthError(t("Enter your applicant and store names before continuing.", "أدخل اسم مقدم الطلب واسم المتجر قبل المتابعة.")); return; }
    if (!turnstileToken) { setOauthError(t("Please complete the bot check before continuing.", "أكمل التحقق من الروبوت قبل المتابعة.")); return; }
    setBusy(true);
    setOauthError("");
    try {
      const challengeResponse = await fetch("/api/auth/registration-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
        cache: "no-store"
      });
      const challengeResult = await challengeResponse.json() as { error?: string };
      if (!challengeResponse.ok) throw new Error(challengeResult.error || t("The bot check could not be completed.", "تعذّر إكمال التحقق من الروبوت."));

      const params = new URLSearchParams({
        intent: "register",
        accountType,
        acceptedTerms: "1",
        acceptedPrivacy: "1",
        returnTo: currentReturnPath()
      });
      if (accountType === "SELLER") { params.set("sellerLegalName", sellerLegalName); params.set("sellerDisplayName", sellerDisplayName); }
      window.location.assign(new URL("/api/auth/google/start?" + params.toString(), window.location.origin).toString());
    } catch (cause) {
      setOauthError(cause instanceof Error ? cause.message : t("The bot check could not be completed.", "تعذّر إكمال التحقق من الروبوت."));
      setTurnstileToken("");
      setTurnstileResetVersion((version) => version + 1);
      setBusy(false);
    }
  }

  async function resendVerificationEmail() {
    if (!email.trim() || resending) return;
    setResending(true); setError(""); setResendNotice("");
    try {
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }), cache: "no-store"
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || t("Unable to request a verification email.", "تعذر طلب رسالة التحقق."));
      setResendNotice(result.message || t("If the account is eligible, a verification email will be sent.", "إذا كان الحساب مؤهلًا، فستُرسل رسالة تحقق."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to request a verification email.", "تعذر طلب رسالة التحقق."));
    } finally { setResending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !registrationAvailable || registrationComplete) return;
    if (!turnstileToken) { setError(t("Please complete the bot check before creating an account.", "أكمل التحقق من الروبوت قبل إنشاء الحساب.")); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password, accountType, sellerLegalName: accountType === "SELLER" ? sellerLegalName : undefined, sellerDisplayName: accountType === "SELLER" ? sellerDisplayName : undefined, acceptedTerms, acceptedPrivacy, turnstileToken }),
        cache: "no-store"
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || t("Registration could not be completed.", "تعذّر إكمال التسجيل."));
      setPassword("");
      setRegistrationComplete(true);
      setDeliveryUnavailable(response.status === 202);
      setTurnstileToken("");
      setTurnstileResetVersion((version) => version + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Registration could not be completed.", "تعذّر إكمال التسجيل."));
      setTurnstileToken("");
      setTurnstileResetVersion((version) => version + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">{t("Back to marketplace", "العودة إلى السوق")}</Link>
        </header>
        <div className="grid overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white shadow-[var(--shadow-card)] lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="relative hidden overflow-hidden bg-[var(--color-forest-950)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(190,130,87,.38),transparent_38%),linear-gradient(145deg,transparent,rgba(0,0,0,.24))]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[.24em] text-[var(--color-copper-100)]">{t("Join Mtjr2", "انضم إلى متجر ٢")}</p>
              <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight xl:text-5xl">{t("One account. A world of possibilities.", "حساب واحد. آفاق واسعة من الإمكانات.")}</h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/75">{t("Shop from stores, manage your orders and favorites, or apply to build your business on the marketplace.", "تسوّق من المتاجر وأدر طلباتك ومفضلاتك، أو قدّم طلبًا لتنمية أعمالك عبر السوق.")}</p>
            </div>
            <div className="relative rounded-2xl border border-white/15 bg-white/5 p-5">
              <p className="text-sm font-semibold text-[var(--color-copper-100)]">{t("A safer marketplace starts here", "سوق أكثر أمانًا يبدأ من هنا")}</p>
              <p className="mt-2 text-sm leading-6 text-white/75">{t("Bot checks help protect accounts, and seller applications are reviewed before selling permissions are granted.", "يساعد التحقق الآلي على حماية الحسابات، وتُراجع طلبات البائعين قبل منح صلاحية البيع.")}</p>
            </div>
          </aside>
          <section className="w-full px-5 py-8 sm:px-9 lg:px-12 xl:px-14">
            <div className="mx-auto w-full max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Mtjr2 account · development", "حساب متجر ٢ · نسخة تطويرية")}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{t("Create your account", "أنشئ حسابك")}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("Create an account to explore the marketplace. Verify your email before signing in.", "أنشئ حسابًا لاستكشاف السوق. تحقق من بريدك الإلكتروني قبل تسجيل الدخول.")}</p>
          {!registrationAvailable && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("Account registration is currently unavailable. Existing customers can still sign in.", "تسجيل الحسابات الجديدة غير متاح حاليًا. يمكن للعملاء الحاليين تسجيل الدخول.")}</p>}
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{t("Development preview: these policy documents are initial project drafts, not final legal terms. Public production registration remains disabled.", "معاينة تطويرية: وثائق السياسات هذه مسودات أولية للمشروع وليست شروطًا قانونية نهائية. يظل التسجيل العام في الإنتاج معطلًا.")}</p>
          {registrationComplete && <section role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">{t("Your account has been created.", "تم إنشاء حسابك.")}</p><p className="mt-1">{deliveryUnavailable ? t("Email delivery is temporarily unavailable. Request a new verification email below before signing in.", "إرسال البريد غير متاح مؤقتًا. اطلب رسالة تحقق جديدة أدناه قبل تسجيل الدخول.") : t("Check your inbox and verify your email address before signing in.", "تحقق من صندوق الوارد وأكد بريدك الإلكتروني قبل تسجيل الدخول.")}</p><button type="button" onClick={() => void resendVerificationEmail()} disabled={resending} className="mt-3 rounded-lg bg-[var(--color-forest-900)] px-4 py-2 font-semibold text-white disabled:opacity-50">{resending ? t("Sending…", "جارٍ الإرسال…") : t("Resend verification email", "إعادة إرسال رسالة التحقق")}</button>{resendNotice && <p className="mt-3">{resendNotice}</p>}</section>}
          {oauthError && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{localizeOAuthError(oauthError)}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">{t("How will you use Mtjr2?", "كيف ستستخدم متجر ٢؟")}</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
                <input type="radio" name="accountType" value="CUSTOMER" checked={accountType === "CUSTOMER"} onChange={() => setAccountType("CUSTOMER")} className="mt-1" />
                <span><strong className="block text-sm">{t("Customer / buyer", "عميل / مشتري")}</strong><span className="text-xs text-[var(--muted)]">{t("Discover products, save favorites and manage your orders.", "اكتشف المنتجات واحفظ المفضلة وأدر طلباتك.")}</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
                <input type="radio" name="accountType" value="SELLER" checked={accountType === "SELLER"} onChange={() => setAccountType("SELLER")} className="mt-1" />
                <span><strong className="block text-sm">{t("Seller", "بائع")}</strong><span className="text-xs text-[var(--muted)]">{t("Apply to open a store. Selling permissions are granted only after review.", "قدّم طلبًا لفتح متجر. تُمنح صلاحيات البيع بعد المراجعة فقط.")}</span></span>
              </label>
            </fieldset>
            {accountType === "SELLER" && <div className="space-y-4 rounded-xl bg-[var(--color-ivory-100)] p-4">
              <label className="block text-sm font-medium">{t("Legal business / applicant name", "الاسم القانوني للمنشأة / مقدم الطلب")}<input className={fieldClass} value={sellerLegalName} onChange={event => setSellerLegalName(event.target.value)} required minLength={2} maxLength={160} /></label>
              <label className="block text-sm font-medium">{t("Public store name", "اسم المتجر الظاهر")}<input className={fieldClass} value={sellerDisplayName} onChange={event => setSellerDisplayName(event.target.value)} required minLength={2} maxLength={80} /></label>
              <p className="text-xs leading-5 text-[var(--muted)]">{t("This creates a pending seller application. Your store cannot publish products until the marketplace approves it.", "ينشئ هذا طلب بائع قيد الانتظار. لن يتمكن متجرك من نشر المنتجات حتى يوافق السوق على الطلب.")}</p>
            </div>}
            <label className="block text-sm font-medium">{t("Display name", "الاسم المعروض")} <span className="font-normal text-[var(--muted)]">({t("optional", "اختياري")})</span>
              <input className={fieldClass} value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" />
            </label>
            <label className="block text-sm font-medium">{t("Email address", "البريد الإلكتروني")}
              <input className={fieldClass} type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
            </label>
            <label className="block text-sm font-medium">{t("Password", "كلمة المرور")}
              <input className={fieldClass} type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{t("Use 12–128 characters.", "استخدم من ١٢ إلى ١٢٨ حرفًا.")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input className="mt-1 size-4 shrink-0 accent-[var(--color-forest-900)]" type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required />
              <span>{t("I have read and accept the", "قرأت وأوافق على")} <Link className="font-semibold text-[var(--color-forest-800)] underline" href="/terms" target="_blank">{t("Terms of Use", "شروط الاستخدام")}</Link> ({t("version", "الإصدار")} v1).</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input className="mt-1 size-4 shrink-0 accent-[var(--color-forest-900)]" type="checkbox" checked={acceptedPrivacy} onChange={event => setAcceptedPrivacy(event.target.checked)} required />
              <span>{t("I have read the", "قرأت")} <Link className="font-semibold text-[var(--color-forest-800)] underline" href="/privacy" target="_blank">{t("Privacy Notice", "إشعار الخصوصية")}</Link> ({t("version", "الإصدار")} v1).</span>
            </label>
            <RegistrationTurnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} resetVersion={turnstileResetVersion} />
            <button className={buttonClass} disabled={!registrationAvailable || registrationComplete || busy || !turnstileToken || !acceptedTerms || !acceptedPrivacy || (accountType === "SELLER" && (!sellerLegalName.trim() || !sellerDisplayName.trim()))}>{busy ? t("Creating account…", "جارٍ إنشاء الحساب…") : t("Create account", "إنشاء حساب")}</button>
            <div className="flex items-center gap-3 py-1 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--border)]" />{t("OR", "أو")}<span className="h-px flex-1 bg-[var(--border)]" /></div>
            <button type="button" onClick={continueWithGoogle} disabled={!registrationAvailable || busy || !turnstileToken || !acceptedTerms || !acceptedPrivacy || (accountType === "SELLER" && (!sellerLegalName.trim() || !sellerDisplayName.trim()))} className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--color-ivory-100)] disabled:cursor-not-allowed disabled:opacity-50"><span className="text-base font-bold">G</span>{t("Continue with Google", "المتابعة باستخدام Google")}</button>
          </form>
          <div className="mt-6 flex flex-wrap gap-x-2 gap-y-1 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
            <span>{t("Already have an account?", "لديك حساب بالفعل؟")}</span>
            <AuthReturnLink className="font-semibold text-[var(--color-forest-800)] hover:underline" href="/login">{t("Sign in", "تسجيل الدخول")}</AuthReturnLink>
          </div>
          </div>
          </section>
        </div>
      </div>
    </main>
  );
}
