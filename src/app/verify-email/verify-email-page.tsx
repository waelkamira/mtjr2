"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function VerifyEmailPage() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (!token) { setMessage("This verification link is missing its token."); setFailed(true); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }), cache: "no-store"
      });
      const result = await response.json() as { message?: string; error?: string };
      setMessage(response.ok ? (result.message ?? "Email verified.") : (result.error ?? "This link is invalid or expired."));
      setFailed(!response.ok);
      window.history.replaceState(null, "", "/verify-email");
    } catch {
      setMessage("Unable to verify your email right now. Please try again.");
      setFailed(true);
    } finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
    <section className="w-full rounded-3xl border border-[var(--border)] bg-white p-8 shadow-[var(--shadow-card)] sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-copper-600)]">Mtjr · Account security</p>
      <h1 className="mt-4 text-3xl font-semibold text-[var(--color-forest-950)]">Email verification</h1>
      <p role="status" aria-live="polite" className={`mt-5 leading-7 ${failed ? "text-[var(--color-danger)]" : "text-[var(--color-ink-700)]"}`}>{message || "Confirm your email address to activate your account."}</p>
      <button onClick={verify} disabled={busy || !token || Boolean(message && !failed)} className="mt-8 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 font-medium text-white disabled:opacity-50">{busy ? "Verifying…" : "Verify email address"}</button>
      <div><Link href="/login" className="mt-5 inline-flex text-sm font-medium text-[var(--color-forest-800)]">Continue to sign in</Link></div>
    </section>
  </main>;
}
