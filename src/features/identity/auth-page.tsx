"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthReturnLink from "@/components/auth-return-link";
import { currentReturnPath } from "@/lib/current-return-path";

type AuthMode = "login" | "forgot" | "reset";

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

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-copper-500)]";
const buttonClass = "inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-forest-900)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-forest-800)] disabled:cursor-not-allowed disabled:opacity-55";

export default function AuthPage({ mode, initialToken = "", initialEmail = "", initialOAuthError = "" }: { mode: AuthMode; initialToken?: string; initialEmail?: string; initialOAuthError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken);
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
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "login") {
        const result = await postJson("/api/auth/login", { email, password });
        setNotice(result.message || "Signed in. Redirecting…");
        setPassword("");
        router.replace(currentReturnPath());
      } else if (mode === "forgot") {
        const result = await postJson("/api/auth/password-reset/request", { email });
        setNotice(result.message || "If an eligible account exists, reset instructions will be sent.");
      } else if (mode === "reset") {
        const result = await postJson("/api/auth/password-reset/complete", { token, password });
        setNotice(result.message || "Password updated. You can now sign in.");
        setPassword("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
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
    login: "Welcome back",
    forgot: "Reset your password",
    reset: "Choose a new password"
  }[mode];
  const description = {
    login: "Sign in to continue to your marketplace account.",
    forgot: "Enter your email and we’ll send instructions if an eligible account exists.",
    reset: "Choose a new password. Your other active sessions will be signed out."
  }[mode];

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Back to marketplace</Link>
        </header>
        <div className="clay-surface grid overflow-hidden rounded-[2rem] border-white/80 bg-[var(--surface)] lg:min-h-[650px] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden overflow-hidden bg-[var(--color-lavender-100)] p-10 text-[var(--color-lavender-950)] lg:flex lg:flex-col lg:justify-between xl:p-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(190,130,87,.35),transparent_42%),linear-gradient(145deg,transparent,rgba(0,0,0,.2))]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[.24em] text-[var(--color-lavender-600)]">Mtjr2 marketplace</p>
              <h2 className="mt-8 max-w-md text-4xl font-semibold leading-tight xl:text-5xl">{mode === "login" ? "Your marketplace. One secure account." : "Your account, protected at every step."}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-[var(--color-lavender-800)]/80">{mode === "login" ? "Discover products, manage orders, save favorites and connect with trusted stores." : "Protect your sessions and keep account recovery simple."}</p>
            </div>
            <div className="relative space-y-4 text-sm text-white/80">
              <p>01 · One account for shopping and selling</p>
              <p>02 · Secure sessions and account recovery</p>
              <p>03 · Seller access after marketplace review</p>
            </div>
          </aside>
          <section className="w-full px-6 py-8 sm:px-9 lg:px-12 xl:px-14">
            <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Mtjr2 account</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
          {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-6 rounded-xl border border-[var(--color-sage-200)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-900)]">{notice}</p>}

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

          {mode === "login" && (
            <div className="mt-5">
              <div className="mb-4 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--border)]" />OR<span className="h-px flex-1 bg-[var(--border)]" /></div>
              <button type="button" className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--color-forest-900)] transition hover:bg-[var(--color-ivory-100)] disabled:opacity-55" onClick={continueWithGoogle} disabled={busy}>
                <span aria-hidden="true" className="text-base font-bold">G</span>Continue with Google
              </button>
            </div>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm">
            {mode === "login" && <><Link className="font-medium text-[var(--color-forest-800)] hover:underline" href="/forgot-password">Forgot password?</Link><AuthReturnLink className="font-medium text-[var(--color-forest-800)] hover:underline" href="/register">Create account</AuthReturnLink></>}
            {(mode === "forgot" || mode === "reset") && <Link className="font-semibold text-[var(--color-forest-800)] hover:underline" href="/login">Back to sign in</Link>}
          </div>
          </div>
          </section>
        </div>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">Secure account access · Your password is never sent by email.</p>
      </div>
    </main>
  );
}
