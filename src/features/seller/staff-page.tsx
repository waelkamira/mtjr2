"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Store = { id: string; name: string; slug: string; isOwner: boolean };
type Workspace = { stores: Store[] };
type Staff = {
  id: string; status: "INVITED" | "ACTIVE" | "REVOKED"; invitedAt: string; acceptedAt: string | null;
  user: { id: string; email: string; displayName: string | null };
  invitedBy: { id: string; email: string; displayName: string | null } | null;
};
type Invitation = {
  id: string; invitedAt: string; store: { id: string; name: string; slug: string };
  invitedBy: { displayName: string | null; email: string } | null;
};

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

export default function SellerStaffPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStaff = useCallback(async (id: string) => {
    if (!id) { setStaff([]); return; }
    const result = await json<{ items: Staff[] }>(await fetch(`/api/stores/${encodeURIComponent(id)}/staff`, { cache: "no-store" }));
    setStaff(result.items);
  }, []);

  const reload = useCallback(async () => {
    const [workspace, inbox] = await Promise.all([
      json<Workspace>(await fetch("/api/seller/stores", { cache: "no-store" })),
      json<{ items: Invitation[] }>(await fetch("/api/stores/staff-invitations", { cache: "no-store" }))
    ]);
    setStores(workspace.stores);
    setInvitations(inbox.items);
    const nextId = workspace.stores.some((store) => store.id === storeId) ? storeId : workspace.stores[0]?.id ?? "";
    setStoreId(nextId);
    await loadStaff(nextId);
  }, [loadStaff, storeId]);

  useEffect(() => { reload().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load staff workspace.")); }, [reload]);
  useEffect(() => { if (storeId) loadStaff(storeId).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load staff.")); }, [storeId, loadStaff]);

  async function action(path: string, success: string, method = "POST", body?: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }));
      setMessage(success);
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); }
    finally { setBusy(false); }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    void action(`/api/stores/${encodeURIComponent(storeId)}/staff`, "Invitation sent.", "POST", { userId }).then(() => setUserId(""));
  }

  const selectedStore = stores.find((store) => store.id === storeId);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--color-ivory-50)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/seller" className="text-sm font-semibold text-[var(--color-forest-900)]">Back to workspace</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Store access</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Team & invitations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Invite existing active accounts, review membership status, accept invitations addressed to you, and revoke access. All permissions are enforced by the server for the selected store.</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-950)]">{message}</p>}

        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-semibold">Your invitations</h2>
          {!invitations.length ? <p className="mt-3 text-sm text-[var(--muted)]">You have no pending store invitations.</p> : <div className="mt-4 grid gap-3">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-ivory-100)] p-4"><div><p className="font-medium">{invitation.store.name}</p><p className="mt-1 text-xs text-[var(--muted)]">Invited by {invitation.invitedBy?.displayName ?? invitation.invitedBy?.email ?? "Store owner"}</p></div><button disabled={busy} onClick={() => void action(`/api/stores/staff-invitations/${encodeURIComponent(invitation.id)}/accept`, "Invitation accepted.")} className="rounded-lg bg-[var(--color-forest-900)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Accept invitation</button></div>)}</div>}
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Store team</h2><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div>
          {!stores.length ? <p className="mt-4 text-sm text-[var(--muted)]">No stores are available in your account.</p> : <>
            {selectedStore?.isOwner && <form onSubmit={invite} className="mt-5 grid gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 sm:grid-cols-[1fr_auto] sm:items-end"><label className="grid gap-2 text-sm font-medium">Existing user ID<input required value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Paste the account user ID" className="rounded-lg border border-[var(--border)] px-3 py-2.5 font-normal" /></label><button disabled={busy || !userId.trim()} className="rounded-lg bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Invite member</button><p className="text-xs text-[var(--muted)] sm:col-span-2">Invitations are currently sent to existing active accounts using their account ID.</p></form>}
            <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3 pr-3">Member</th><th className="py-3 pr-3">Status</th><th className="py-3 pr-3">Invited</th><th className="py-3">Action</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-3"><p className="font-medium">{member.user.displayName ?? member.user.email}</p><p className="text-xs text-[var(--muted)]">{member.user.email}</p></td><td className="py-3 pr-3">{member.status}</td><td className="py-3 pr-3">{new Date(member.invitedAt).toLocaleDateString()}</td><td className="py-3">{selectedStore?.isOwner && member.status !== "REVOKED" ? <button disabled={busy} onClick={() => void action(`/api/stores/staff-memberships/${encodeURIComponent(member.id)}/revoke`, "Store access revoked.")} className="text-xs font-semibold text-red-700 disabled:opacity-50">Revoke access</button> : "—"}</td></tr>)}</tbody></table>{!staff.length && <p className="py-6 text-sm text-[var(--muted)]">No staff memberships for this store yet.</p>}</div>
          </>}
        </section>
      </div>
    </main>
  );
}
