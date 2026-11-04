"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--color-copper-500)]";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      if (!response.ok) throw new Error(result.error || "Unable to update your password.");
      setCurrentPassword("");
      setNewPassword("");
      setNotice(result.message || "Password updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/account" className="text-sm text-[var(--color-forest-800)]">← My account</Link>
        <h1 className="mt-5 text-3xl font-semibold">Security</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Protect your account and review signed-in devices.</p>
        <div className="mt-7 space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="font-semibold">Change password</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Confirm your current password. Other active sessions and password-reset links will be revoked.</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
            <form onSubmit={changePassword} className="mt-4 space-y-4">
              <label className="block text-sm font-medium">Current password
                <input className={fieldClass} type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required maxLength={128} />
              </label>
              <label className="block text-sm font-medium">New password
                <input className={fieldClass} type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required minLength={12} maxLength={128} />
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Use 12–128 characters.</span>
              </label>
              <button disabled={busy} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
            <p className="mt-4 text-sm text-[var(--muted)]">Forgot your current password? <Link href="/forgot-password" className="font-semibold text-[var(--color-forest-800)]">Reset it by email</Link>.</p>
          </section>
          <Link href="/account/sessions" className="block rounded-2xl border border-[var(--border)] bg-white p-5">
            <b>Active sessions</b>
            <p className="mt-1 text-sm text-[var(--muted)]">Review and revoke sessions on devices you no longer use.</p>
          </Link>
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-5">
            <b>Two-factor authentication</b>
            <p className="mt-1 text-sm text-[var(--muted)]">Not enabled yet. Enrollment and recovery are not available, so this control is intentionally disabled.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
