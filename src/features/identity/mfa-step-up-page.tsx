"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getAuthReturnPath } from "@/lib/auth-return";

export default function MfaStepUpPage({ initialReturnTo }: { initialReturnTo: string }) {
  const router = useRouter();
  const returnTo = getAuthReturnPath(initialReturnTo);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/step-up", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }), cache: "no-store"
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Verification failed.");
      router.replace(returnTo); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[var(--background)] px-5 py-12"><section className="mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-copper-600)]">Additional verification</p>
    <h1 className="mt-2 text-2xl font-semibold">Verify your identity</h1>
    <p className="mt-2 text-sm text-[var(--muted)]">Enter a current authenticator code or one unused recovery code to continue to the protected platform area.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Verification code
        <input value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3" required />
      </label>
      <button disabled={busy || !code.trim()} className="w-full rounded-xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Verifying…" : "Verify and continue"}</button>
    </form>
  </section></main>;
}
