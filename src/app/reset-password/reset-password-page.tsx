"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setMessage("This reset link is missing its token."); setFailed(true); return; }
    if (password !== confirm) { setMessage("Passwords do not match."); setFailed(true); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }), cache: "no-store"
      });
      const result = await response.json() as { message?: string; error?: string };
      setMessage(response.ok ? (result.message ?? "Password updated.") : (result.error ?? "This reset link is invalid or expired."));
      setFailed(!response.ok);
      if (response.ok) {
        window.history.replaceState(null, "", "/reset-password");
        setPassword(""); setConfirm("");
      }
    } catch { setMessage("Unable to reset your password right now."); setFailed(true); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
    <section className="w-full rounded-3xl border border-[var(--border)] bg-white p-8 shadow-[var(--shadow-card)] sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-copper-600)]">Mtjr · Account security</p>
      <h1 className="mt-4 text-3xl font-semibold text-[var(--color-forest-950)]">Choose a new password</h1>
      <p className="mt-3 leading-7 text-[var(--color-ink-700)]">Use 12–128 characters. Your other active sessions will be revoked after the password changes.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-medium">New password
          <input autoComplete="new-password" type="password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" />
        </label>
        <label className="block text-sm font-medium">Confirm new password
          <input autoComplete="new-password" type="password" minLength={12} maxLength={128} required value={confirm} onChange={event => setConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" />
        </label>
        {message && <p role="status" aria-live="polite" className={failed ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>{message}</p>}
        <button disabled={busy || !token} type="submit" className="w-full rounded-xl bg-[var(--color-forest-900)] px-5 py-3 font-medium text-white disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>
      </form>
      <Link href="/login" className="mt-6 inline-flex text-sm font-medium text-[var(--color-forest-800)]">Back to sign in</Link>
    </section>
  </main>;
}
