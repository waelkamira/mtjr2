"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-copper-500)]";
const buttonClass = "inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-forest-900)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-800)] disabled:cursor-not-allowed disabled:opacity-55";

export default function RegisterForm({ initialOAuthError = "" }: { initialOAuthError?: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"CUSTOMER" | "SELLER">("CUSTOMER");
  const [sellerLegalName, setSellerLegalName] = useState("");
  const [sellerDisplayName, setSellerDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [oauthError, setOauthError] = useState(initialOAuthError);

  function continueWithGoogle() {
    if (!acceptedTerms || !acceptedPrivacy) { setOauthError("Please accept both policy documents before continuing."); return; }
    if (accountType === "SELLER" && (!sellerLegalName.trim() || !sellerDisplayName.trim())) { setOauthError("Enter your applicant and store names before continuing."); return; }
    const params = new URLSearchParams({ accountType, acceptedTerms: "1", acceptedPrivacy: "1" });
    if (accountType === "SELLER") { params.set("sellerLegalName", sellerLegalName); params.set("sellerDisplayName", sellerDisplayName); }
    window.location.assign("/api/auth/google/start?" + params.toString());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password, accountType, sellerLegalName: accountType === "SELLER" ? sellerLegalName : undefined, sellerDisplayName: accountType === "SELLER" ? sellerDisplayName : undefined, acceptedTerms, acceptedPrivacy }),
        cache: "no-store"
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Registration could not be completed.");
      setNotice(result.message || "Account created. Check your email to verify your address.");
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Back to marketplace</Link>
        </header>
        <section className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Mtjr2 account · development</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Create your account</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Create a test account to explore the marketplace during development. Email verification is required.</p>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">Development preview: these policy documents are initial project drafts, not final legal terms. Public production registration remains disabled.</p>
          {oauthError && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{oauthError}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--color-sage-200)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-900)]">{notice}</p>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">How will you use Mtjr2?</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
                <input type="radio" name="accountType" value="CUSTOMER" checked={accountType === "CUSTOMER"} onChange={() => setAccountType("CUSTOMER")} className="mt-1" />
                <span><strong className="block text-sm">Customer / buyer</strong><span className="text-xs text-[var(--muted)]">Discover products, save favorites and manage your orders.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
                <input type="radio" name="accountType" value="SELLER" checked={accountType === "SELLER"} onChange={() => setAccountType("SELLER")} className="mt-1" />
                <span><strong className="block text-sm">Seller</strong><span className="text-xs text-[var(--muted)]">Apply to open a store. Selling permissions are granted only after review.</span></span>
              </label>
            </fieldset>
            {accountType === "SELLER" && <div className="space-y-4 rounded-xl bg-[var(--color-ivory-100)] p-4">
              <label className="block text-sm font-medium">Legal business / applicant name<input className={fieldClass} value={sellerLegalName} onChange={event => setSellerLegalName(event.target.value)} required minLength={2} maxLength={160} /></label>
              <label className="block text-sm font-medium">Public store name<input className={fieldClass} value={sellerDisplayName} onChange={event => setSellerDisplayName(event.target.value)} required minLength={2} maxLength={80} /></label>
              <p className="text-xs leading-5 text-[var(--muted)]">This creates a pending seller application. Your store cannot publish products until the marketplace approves it.</p>
            </div>}
            <label className="block text-sm font-medium">Display name <span className="font-normal text-[var(--muted)]">(optional)</span>
              <input className={fieldClass} value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" />
            </label>
            <label className="block text-sm font-medium">Email address
              <input className={fieldClass} type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
            </label>
            <label className="block text-sm font-medium">Password
              <input className={fieldClass} type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Use 12–128 characters.</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input className="mt-1 size-4 shrink-0 accent-[var(--color-forest-900)]" type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required />
              <span>I have read and accept the <Link className="font-semibold text-[var(--color-forest-800)] underline" href="/terms" target="_blank">Terms of Use</Link> (version v1).</span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input className="mt-1 size-4 shrink-0 accent-[var(--color-forest-900)]" type="checkbox" checked={acceptedPrivacy} onChange={event => setAcceptedPrivacy(event.target.checked)} required />
              <span>I have read the <Link className="font-semibold text-[var(--color-forest-800)] underline" href="/privacy" target="_blank">Privacy Notice</Link> (version v1).</span>
            </label>
            <button className={buttonClass} disabled={busy || !acceptedTerms || !acceptedPrivacy || (accountType === "SELLER" && (!sellerLegalName.trim() || !sellerDisplayName.trim()))}>{busy ? "Creating account…" : "Create account"}</button>
            <div className="flex items-center gap-3 py-1 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--border)]" />OR<span className="h-px flex-1 bg-[var(--border)]" /></div>
            <button type="button" onClick={continueWithGoogle} disabled={busy || !acceptedTerms || !acceptedPrivacy || (accountType === "SELLER" && (!sellerLegalName.trim() || !sellerDisplayName.trim()))} className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--color-ivory-100)] disabled:cursor-not-allowed disabled:opacity-50"><span className="text-base font-bold">G</span>Continue with Google</button>
          </form>
          <p className="mt-6 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">Already have an account? <Link className="font-semibold text-[var(--color-forest-800)] hover:underline" href="/login">Sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
