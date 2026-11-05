"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserDetail = {
  id: string; email: string; displayName: string | null; status: string;
  emailVerifiedAt: string | null; lastLoginAt: string | null; createdAt: string; updatedAt: string;
  roleAssignments: Array<{ id: string; scopeType: string; scopeId: string; assignedAt: string; expiresAt: string | null; role: { key: string; name: string } }>;
  sessions: Array<{ id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; expiresAt: string; revokedAt: string | null }>;
  consents: Array<{ id: string; type: string; version: string; granted: boolean; source: string | null; capturedAt: string }>;
  loginAttempts: Array<{ id: string; succeeded: boolean; attemptedAt: string }>;
  auditEvents: Array<{ id: string; action: string; actorId: string | null; occurredAt: string }>;
  counts: { orders: number; sessions: number; loginAttempts: number; consents: number };
};
const statuses = ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"];

export default function AdminUserDetailPage({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
    const data = await response.json() as { user?: UserDetail; error?: string };
    if (!response.ok || !data.user) throw new Error(data.error || "User profile unavailable.");
    setUser(data.user);
    setStatus(data.user.status);
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
        const data = await response.json() as { user?: UserDetail; error?: string };
        if (!response.ok || !data.user) throw new Error(data.error || "User profile unavailable.");
        if (active) { setUser(data.user); setStatus(data.user.status); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "User profile unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId]);

  async function changeStatus() {
    if (!user || status === user.status || reason.trim().length < 5) return;
    if (!window.confirm(`Change ${user.email} from ${user.status} to ${status}? Active sessions will be revoked when suspending or disabling.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason })
      });
      const data = await response.json() as { result?: { revokedSessions: number }; error?: string };
      if (!response.ok) throw new Error(data.error || "Account status update failed.");
      setReason("");
      setMessage(`Account status updated. ${data.result?.revokedSessions ?? 0} active session(s) revoked.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account status update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="min-h-screen px-5 py-8"><div className="mx-auto h-48 max-w-5xl animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /></main>;
  if (!user) return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-5xl"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error || "User not found."}</p><Link href="/admin/users" className="mt-4 inline-block underline">Back to users</Link></div></main>;

  const protectedAdmin = user.roleAssignments.some((assignment) => assignment.role.key === "SUPER_ADMIN");
  return <main className="min-h-screen px-5 py-8 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/users" className="text-sm font-semibold text-[var(--color-copper-600)] underline">← Users</Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Account administration</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{user.displayName || user.email}</h1><p className="mt-1 text-sm text-[var(--muted)]">{user.email} · {user.id}</p></div><span className="rounded-full bg-[var(--color-ivory-100)] px-4 py-2 text-sm font-semibold">{user.status}</span></header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Email verification" value={user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString() : "Not verified"} />
        <Info label="Last sign-in" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"} />
        <Info label="Account created" value={new Date(user.createdAt).toLocaleString()} />
        <Info label="Related orders" value={String(user.counts.orders)} />
      </section>
      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold">Account status</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Suspending or disabling revokes active sessions. Re-activation does not restore sessions.</p>
        {protectedAdmin ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Super administrator accounts are protected from status changes.</p> : <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">New status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]">{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">Required administrative reason<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <button disabled={busy || status === user.status || reason.trim().length < 5} onClick={() => void changeStatus()} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Update status"}</button>
        </div>}
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title={`Role assignments (${user.roleAssignments.length})`}>
          {user.roleAssignments.length ? user.roleAssignments.map((assignment) => <div key={assignment.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold">{assignment.role.name} <span className="text-xs font-normal text-[var(--muted)]">{assignment.role.key}</span></p><p className="mt-1 text-xs text-[var(--muted)]">{assignment.scopeType}: {assignment.scopeId} · assigned {new Date(assignment.assignedAt).toLocaleDateString()}{assignment.expiresAt ? ` · expires ${new Date(assignment.expiresAt).toLocaleDateString()}` : ""}</p></div>) : <p className="text-sm text-[var(--muted)]">No assigned roles.</p>}
          <p className="mt-3 text-xs text-[var(--muted)]">Role assignment changes use the separate privilege-delegation API and require roles:assign.</p>
        </Panel>
        <Panel title={`Recent sessions (${user.counts.sessions} total)`}>
          {user.sessions.length ? user.sessions.map((session) => <div key={session.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold">{session.revokedAt ? "Revoked" : session.expiresAt < new Date().toISOString() ? "Expired" : "Active"} · {session.ipAddress || "IP unavailable"}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.userAgent || "Device information unavailable"}</p><p className="mt-1 text-xs text-[var(--muted)]">Last seen {new Date(session.lastSeenAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleString()}</p></div>) : <p className="text-sm text-[var(--muted)]">No sessions recorded.</p>}
        </Panel>
        <Panel title={`Consent history (${user.counts.consents} total)`}>
          {user.consents.length ? user.consents.map((consent) => <div key={consent.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold">{consent.type.replaceAll("_", " ")} · {consent.granted ? "Granted" : "Withdrawn"}</p><p className="mt-1 text-xs text-[var(--muted)]">Version {consent.version} · {consent.source || "source unavailable"} · {new Date(consent.capturedAt).toLocaleString()}</p></div>) : <p className="text-sm text-[var(--muted)]">No consent records.</p>}
        </Panel>
        <Panel title={`Recent login attempts (${user.counts.loginAttempts} total)`}>
          {user.loginAttempts.length ? user.loginAttempts.map((attempt) => <div key={attempt.id} className="flex justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><span className={attempt.succeeded ? "text-green-800" : "text-red-700"}>{attempt.succeeded ? "Successful" : "Failed"}</span><time className="text-xs text-[var(--muted)]">{new Date(attempt.attemptedAt).toLocaleString()}</time></div>) : <p className="text-sm text-[var(--muted)]">No attempts recorded.</p>}
        </Panel>
        <Panel title="Administrative activity">
          {user.auditEvents.length ? user.auditEvents.map((event) => <div key={event.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold">{event.action.replaceAll(".", " ")}</p><p className="mt-1 text-xs text-[var(--muted)]">Actor {event.actorId || "system"} · {new Date(event.occurredAt).toLocaleString()}</p></div>) : <p className="text-sm text-[var(--muted)]">No administrative events recorded for this account.</p>}
        </Panel>
      </section>
      <p className="mt-5 text-xs text-[var(--muted)]">Two-factor authentication and KYC status are not available in the current data model.</p>
    </div>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 font-semibold">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="mb-3 text-lg font-semibold">{title}</h2>{children}</section>;
}
