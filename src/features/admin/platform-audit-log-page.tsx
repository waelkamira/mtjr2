"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AuditEvent = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  scopeType: string | null;
  scopeId: string | null;
  metadata: unknown;
  occurredAt: string;
  actor: { displayName: string | null; email: string } | null;
};

type AuditResponse = { events: AuditEvent[]; nextCursor: string | null; limit: number };

export default function PlatformAuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (next: string | null, append: boolean) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (action.trim()) params.set("action", action.trim());
      if (resource.trim()) params.set("resource", resource.trim());
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/control-panel/audit-log?${params}`, { cache: "no-store" });
      const data = await response.json() as AuditResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load audit events.");
      setEvents((current) => append ? [...current, ...data.events] : data.events);
      setCursor(next);
      setNextCursor(data.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load audit events.");
    } finally {
      setLoading(false);
    }
  }, [action, resource]);

  useEffect(() => { void load(null, false); }, [load]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvents([]);
    setCursor(null);
    setNextCursor(null);
    void load(null, false);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/control-panel" className="text-sm font-medium text-[var(--color-copper-600)] hover:underline">← Platform control panel</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Security & governance</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Platform audit log</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Read-only history of privileged and operational changes recorded by the platform.</p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]">Newest first · private data</span>
        </div>

        <form onSubmit={applyFilters} className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">Action contains<input value={action} onChange={(event) => setAction(event.target.value)} maxLength={160} placeholder="identity.role_assignment" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">Resource contains<input value={resource} onChange={(event) => setResource(event.target.value)} maxLength={120} placeholder="user_role_assignment" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <button disabled={loading} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Filter</button>
        </form>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {events.length === 0 && !loading ? <p className="p-8 text-center text-sm text-[var(--muted)]">No audit events match these filters.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--color-ivory-100)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Actor</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Resource</th><th className="px-4 py-3 font-medium">Scope</th><th className="px-4 py-3 font-medium">Details</th></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {events.map((event) => (
                    <tr key={event.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">{new Date(event.occurredAt).toLocaleString()}</td>
                      <td className="px-4 py-3"><div className="font-medium">{event.actor?.displayName || event.actor?.email || event.actorId || event.actorType}</div><div className="mt-1 text-xs text-[var(--muted)]">{event.actorType}</div></td>
                      <td className="px-4 py-3 font-medium text-[var(--color-forest-950)]">{event.action}</td>
                      <td className="px-4 py-3"><div>{event.resource}</div><div className="mt-1 break-all text-xs text-[var(--muted)]">{event.resourceId || "—"}</div></td>
                      <td className="px-4 py-3 text-xs">{event.scopeType ? `${event.scopeType}: ${event.scopeId || "—"}` : "—"}</td>
                      <td className="max-w-sm px-4 py-3"><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{event.metadata ? JSON.stringify(event.metadata, null, 2) : "—"}</pre></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {loading && <p role="status" className="border-t border-[var(--border)] p-4 text-sm text-[var(--muted)]">Loading audit events…</p>}
          {!loading && nextCursor && <div className="border-t border-[var(--border)] p-4 text-center"><button onClick={() => void load(nextCursor, true)} className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--color-ivory-100)]">Load older events</button></div>}
        </section>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Audit events are displayed as recorded. This view does not permit editing or deleting history.</p>
      </div>
    </main>
  );
}
