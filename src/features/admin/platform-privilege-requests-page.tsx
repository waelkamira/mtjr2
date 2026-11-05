"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type RequestItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  decisionNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  targetUser: { id: string; displayName: string | null; email: string; status: string };
  requester: { id: string; displayName: string | null; email: string };
  reviewer: { id: string; displayName: string | null; email: string } | null;
};

export default function PlatformPrivilegeRequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/control-panel/privilege-requests", { cache: "no-store" });
    const data = await response.json() as { requests?: RequestItem[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load requests.");
    setRequests(data.requests || []);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load())
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load requests."))
      .finally(() => setLoading(false));
  }, [load]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/control-panel/privilege-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to submit request.");
      setEmail(""); setReason(""); setNotice("Privilege request submitted for independent review.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit request.");
    } finally { setSaving(false); }
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/control-panel/privilege-requests/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: decisionNote[id] || "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to process decision.");
      setNotice(decision === "APPROVE" ? "Request approved; platform access was granted." : "Request rejected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to process decision.");
    } finally { setSaving(false); }
  }

  const pending = requests.filter((request) => request.status === "PENDING");
  const history = requests.filter((request) => request.status !== "PENDING");

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/control-panel" className="text-sm font-medium text-[var(--color-copper-600)] hover:underline">← Platform control panel</Link>
        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Security & governance</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Super Admin privilege approvals</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">A two-person control for granting platform-wide access. The requester cannot approve or reject their own request; approvals grant only the canonical SUPER_ADMIN role.</p>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--color-forest-950)]">{notice}</p>}

        <form onSubmit={submitRequest} className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div><h2 className="font-semibold text-[var(--color-forest-950)]">Request platform access for a user</h2><p className="mt-1 text-xs text-[var(--muted)]">Target must be an existing active account. A different Super Admin must review this request.</p></div>
          <label className="text-xs font-medium text-[var(--muted)]">User email<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">Business justification<textarea required minLength={20} maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this person needs platform-wide management access…" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)]" /></label>
          <button disabled={saving} className="justify-self-start rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Processing…" : "Submit access request"}</button>
        </form>

        <section className="mt-8">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-[var(--color-forest-950)]">Pending review</h2><span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">{pending.length} pending</span></div>
          {loading ? <p className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">Loading requests…</p> : pending.length === 0 ? <p className="mt-4 rounded-xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">No pending privilege requests.</p> : (
            <div className="mt-4 space-y-3">
              {pending.map((request) => <article key={request.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-[var(--color-forest-950)]">{request.targetUser.displayName || request.targetUser.email}</h3><p className="mt-1 text-sm text-[var(--muted)]">{request.targetUser.email} · {request.targetUser.status}</p></div><span className="text-xs text-[var(--muted)]">Requested {new Date(request.requestedAt).toLocaleString()}</span></div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{request.reason}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">Requested by {request.requester.displayName || request.requester.email}</p>
                <label className="mt-4 block text-xs font-medium text-[var(--muted)]">Decision note (optional)<textarea rows={2} maxLength={1000} value={decisionNote[request.id] || ""} onChange={(event) => setDecisionNote((current) => ({ ...current, [request.id]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void decide(request.id, "APPROVE")} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Approve & grant access</button><button disabled={saving} onClick={() => void decide(request.id, "REJECT")} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">Reject request</button></div>
              </article>)}
            </div>
          )}
        </section>

        {history.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold text-[var(--color-forest-950)]">Decision history</h2><div className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">{history.map((request) => <article key={request.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium">{request.targetUser.displayName || request.targetUser.email} · {request.targetUser.email}</div><span className="text-xs font-semibold">{request.status}</span></div><p className="mt-1 text-xs text-[var(--muted)]">Requested by {request.requester.email} · Reviewed by {request.reviewer?.email || "—"} · {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}</p>{request.decisionNote && <p className="mt-2 text-sm text-[var(--muted)]">{request.decisionNote}</p>}</article>)}</div></section>}
        <p className="mt-5 text-xs leading-5 text-[var(--muted)]">All decisions are recorded in the immutable audit history. This workflow does not expose revocation; emergency removal requires a separately designed break-glass process.</p>
      </div>
    </main>
  );
}
