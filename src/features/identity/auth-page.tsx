"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type AuthMode = "login" | "forgot" | "reset" | "verify";

type ApiResult = { message?: string; error?: string };

async function postJson(path: string, payload: unknown): Promise<ApiResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  let result: ApiResult;
  try { result = await response.json() as ApiResult; }
  catch { throw new Error("The server returned an unreadable response. Please try again."); }
  if (!response.ok) throw new Error(result.error || result.message || "The request could not be completed.");
  return result;
}

function safeReturnPath(): string {
  if (typeof window === "undefined") return "/account/orders";
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/account/orders";
  try {
    const parsed = new URL(candidate, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : "/account/orders";
  } catch { return "/account/orders"; }
}

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-copper-500)]";
const buttonClass = "inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-forest-900)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-800)] disabled:cursor-not-allowed disabled:opacity-55";

export default function AuthPage({ mode, initialToken = "", initialEmail = "" }: { mode: AuthMode; initialToken?: string; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    // Defer URL-derived UI state until after hydration to avoid a server/client mismatch.
    const registrationTimer = window.setTimeout(() => {
      setRegistrationComplete(new URLSearchParams(window.location.search).get("registered") === "1");
    }, 0);
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      params.delete("token");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
    }
    return () => window.clearTimeout(registrationTimer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "login") {
        const result = await postJson("/api/auth/login", { email, password });
        setNotice(result.message || "Signed in successfully. Redirecting…");
        setPassword("");
        window.setTimeout(() => window.location.assign(safeReturnPath()), 900);
      } else if (mode === "forgot") {
        const result = await postJson("/api/auth/password-reset/request", { email });
        setNotice(result.message || "If an eligible account exists, reset instructions will be sent.");
      } else if (mode === "reset") {
        const result = await postJson("/api/auth/password-reset/complete", { token, password });
        setNotice(result.message || "Password updated. You can now sign in.");
        setPassword("");
      } else {
        const result = await postJson("/api/auth/verify-email", { token });
        setNotice(result.message || "Email verified successfully. You can now sign in.");
        setToken("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally { setBusy(false); }
  }

  async function resendVerification() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await postJson("/api/auth/verification/resend", { email });
      setNotice(result.message || "If the account is eligible, a verification email will be sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally { setBusy(false); }
  }

  const title = {
    login: "Welcome back",
    forgot: "Reset your password",
    reset: "Choose a new password",
    verify: "Verify your email"
  }[mode];
  const description = {
    login: "Sign in to continue to your marketplace account.",
    forgot: "Enter your email and we’ll send instructions if an eligible account exists.",
    reset: "Choose a new password. Your other active sessions will be signed out.",
    verify: "Confirm your email address to activate your account."
  }[mode];

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Back to marketplace</Link>
        </header>
        <section className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Mtjr2 account</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
          {mode === "verify" && registrationComplete && <p role="status" className="mt-4 rounded-xl border border-[var(--color-sage-200)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-900)]">Your account was created. Check your inbox for the verification email, then enter the code below.</p>}

          {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-6 rounded-xl border border-[var(--color-sage-200)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-900)]">{notice}</p>}

          {mode === "verify" ? (
            <div className="mt-7 space-y-4">
              <form onSubmit={submit} className="space-y-4">
                <label className="block text-sm font-medium">Verification token
                  <input className={fieldClass} value={token} onChange={e => setToken(e.target.value)} required minLength={43} maxLength={43} autoComplete="one-time-code" />
                </label>
                <button className={buttonClass} disabled={busy || token.length !== 43}>{busy ? "Verifying…" : "Verify email"}</button>
              </form>
              <div className="border-t border-[var(--border)] pt-4">
                <label className="block text-sm font-medium">Email address
                  <input className={fieldClass} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <button type="button" onClick={resendVerification} disabled={busy || !email.trim()} className="mt-3 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{busy ? "Sending…" : "Resend verification email"}</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-5">
              {mode !== "reset" && <label className="block text-sm font-medium">Email address
                <input className={fieldClass} type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
              </label>}
              {(mode === "login" || mode === "reset") && <label className="block text-sm font-medium">{mode === "reset" ? "New password" : "Password"}
                <input className={fieldClass} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === "login" ? 1 : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                {mode !== "login" && <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Use 12–128 characters.</span>}
              </label>}
              {mode === "reset" && <label className="block text-sm font-medium">Reset token
                <input className={fieldClass} value={token} onChange={e => setToken(e.target.value)} required minLength={43} maxLength={43} autoComplete="one-time-code" />
              </label>}
              <button className={buttonClass} disabled={busy || (mode === "reset" && token.length !== 43)}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset instructions" : "Update password"}</button>
            </form>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm">
            {mode === "login" && <><Link className="font-medium text-[var(--color-forest-800)] hover:underline" href="/forgot-password">Forgot password?</Link><Link className="font-medium text-[var(--color-forest-800)] hover:underline" href="/verify-email">Verify email</Link><Link className="font-medium text-[var(--color-forest-800)] hover:underline" href="/register">Create account</Link></>}
            {(mode === "forgot" || mode === "reset" || mode === "verify") && <Link className="font-semibold text-[var(--color-forest-800)] hover:underline" href="/login">Back to sign in</Link>}
          </div>
        </section>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">Secure account access · Your password is never sent by email.</p>
      </div>
    </main>
  );
}
