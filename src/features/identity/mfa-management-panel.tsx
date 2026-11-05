"use client";

import { useEffect, useState } from "react";

type MfaStatus = { enabled: boolean; enrollmentPending: boolean; recoveryCodesRemaining: number };

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string; secret?: string; otpauthUrl?: string; recoveryCodes?: string[]; status?: MfaStatus };
  if (!response.ok) throw new Error(body.error || "The MFA request could not be completed.");
  return body;
}

export default function MfaManagementPanel() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [enrollmentPassword, setEnrollmentPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const result = await readJson(await fetch("/api/account/mfa", { cache: "no-store" }));
    setStatus(result.status ?? null);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/account/mfa", { cache: "no-store" })
      .then(readJson)
      .then(result => { if (active) setStatus(result.status ?? null); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load MFA status."); });
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setRecoveryCodes([]);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The MFA request could not be completed."); }
    finally { setBusy(false); }
  }

  function mutation(path: string, method = "POST", body: unknown = {}) {
    return fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  }

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="font-semibold">Two-factor authentication</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">Use an authenticator app with time-based one-time passwords. Recovery codes are shown only once.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
    {!status ? <p className="mt-4 text-sm text-[var(--muted)]">Loading security status…</p> : <>
      <p className="mt-4 text-sm font-medium">{status.enabled ? "MFA is enabled." : "MFA is not enabled."} {status.enabled ? `${status.recoveryCodesRemaining} recovery codes remain.` : ""}</p>
      {!status.enabled && !secret && <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium">Current password to confirm enrollment
          <input type="password" autoComplete="current-password" value={enrollmentPassword} onChange={event => setEnrollmentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3" />
        </label>
        <button disabled={busy || !enrollmentPassword} onClick={() => void run(async () => {
          const result = await readJson(await mutation("/api/account/mfa/enrollment", "POST", { currentPassword: enrollmentPassword }));
          setSecret(result.secret ?? ""); setEnrollmentPassword("");
          setNotice("Add this secret to your authenticator app, then enter the current six-digit code.");
        })} className="rounded-xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Set up MFA</button>
      </div>}
      {secret && <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
        <p className="text-sm font-semibold">Authenticator secret</p>
        <code className="mt-2 block break-all rounded-lg bg-[var(--background)] p-3 text-sm">{secret}</code>
        <label className="mt-4 block text-sm font-medium">Six-digit verification code
          <input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3" />
        </label>
        <button disabled={busy || code.length !== 6} onClick={() => void run(async () => {
          const result = await readJson(await mutation("/api/account/mfa/confirm", "POST", { code }));
          setSecret(""); setCode(""); setRecoveryCodes(result.recoveryCodes ?? []);
          await refresh(); setNotice("MFA enabled. Save these recovery codes in a secure place.");
        })} className="mt-3 rounded-xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Confirm and enable</button>
      </div>}
      {status.enabled && <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium">Authenticator or recovery code
          <input value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3" />
        </label>
        <button disabled={busy || !code.trim()} onClick={() => void run(async () => {
          const result = await readJson(await mutation("/api/account/mfa/recovery-codes", "POST", { code }));
          setRecoveryCodes(result.recoveryCodes ?? []); setCode(""); await refresh();
          setNotice("New recovery codes generated. Previous codes are no longer valid.");
        })} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50">Regenerate recovery codes</button>
        <label className="block text-sm font-medium">Current password to disable MFA
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3" />
        </label>
        <button disabled={busy || !currentPassword || !code.trim()} onClick={() => void run(async () => {
          await readJson(await mutation("/api/account/mfa", "DELETE", { currentPassword, code }));
          setCurrentPassword(""); setCode(""); await refresh(); setNotice("MFA disabled.");
        })} className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50">Disable MFA</button>
      </div>}
      {recoveryCodes.length > 0 && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold text-amber-950">Save these recovery codes now</p>
        <p className="mt-1 text-xs text-amber-900">They cannot be displayed again. Each code works once.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">{recoveryCodes.map(value => <code key={value} className="rounded bg-white p-2 text-center text-xs">{value}</code>)}</div>
      </div>}
    </>}
  </section>;
}
