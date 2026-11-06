"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

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

async function json<T>(response: Response, fallback = "Request failed."): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? fallback);
  return body as T;
}

export default function SellerStaffPage() {
  const { locale } = useLocale();
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
    const result = await json<{ items: Staff[] }>(await fetch(`/api/stores/${encodeURIComponent(id)}/staff`, { cache: "no-store" }), translate(locale, "Unable to load store staff.", "تعذر تحميل فريق المتجر."));
    setStaff(result.items);
  }, [locale]);

  const reload = useCallback(async () => {
    const [workspace, inbox] = await Promise.all([
      json<Workspace>(await fetch("/api/seller/stores", { cache: "no-store" }), translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر.")),
      json<{ items: Invitation[] }>(await fetch("/api/stores/staff-invitations", { cache: "no-store" }), translate(locale, "Unable to load invitations.", "تعذر تحميل الدعوات."))
    ]);
    setStores(workspace.stores);
    setInvitations(inbox.items);
    const nextId = workspace.stores.some((store) => store.id === storeId) ? storeId : workspace.stores[0]?.id ?? "";
    setStoreId(nextId);
    await loadStaff(nextId);
  }, [loadStaff, storeId, locale]);

  useEffect(() => { Promise.resolve().then(() => reload()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load staff workspace.", "تعذر تحميل مساحة إدارة الفريق."))); }, [reload, locale]);

  async function action(path: string, success: string, method = "POST", body?: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }), translate(locale, "Request failed.", "فشل الطلب."));
      setMessage(success);
      toast.success(success);
      await reload();
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Request failed.", "فشل الطلب."); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    void action(`/api/stores/${encodeURIComponent(storeId)}/staff`, translate(locale, "Invitation sent.", "تم إرسال الدعوة."), "POST", { userId }).then(() => setUserId(""));
  }

  const selectedStore = stores.find((store) => store.id === storeId);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-2xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link>
          <Link href="/seller" className="text-sm font-semibold text-[var(--color-ink-800)]">{translate(locale, "Back to workspace", "العودة إلى مساحة العمل")}</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{translate(locale, "Store access", "إمكانية الوصول إلى المتجر")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Team & invitations", "الفريق والدعوات")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{translate(locale, "Invite existing active accounts, review membership status, accept invitations addressed to you, and revoke access. All permissions are enforced by the server for the selected store.", "ادعُ الحسابات النشطة الحالية، وراجع حالة العضوية، واقبل الدعوات الموجهة إليك، وألغِ الوصول. يفرض الخادم جميع الأذونات على المتجر المحدد.")}</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-ink-950)]">{message}</p>}

        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">{translate(locale, "Your invitations", "دعواتك")}</h2>
          {!invitations.length ? <p className="mt-3 text-sm text-[var(--muted)]">{translate(locale, "You have no pending store invitations.", "ليس لديك دعوات متجر معلقة.")}</p> : <div className="mt-4 grid gap-3">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-4"><div><p className="font-medium">{invitation.store.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Invited by", "بدعوة من")} {invitation.invitedBy?.displayName ?? invitation.invitedBy?.email ?? translate(locale, "Store owner", "مالك المتجر")}</p></div><button disabled={busy} onClick={() => void action(`/api/stores/staff-invitations/${encodeURIComponent(invitation.id)}/accept`, translate(locale, "Invitation accepted.", "تم قبول الدعوة."))} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{translate(locale, "Accept invitation", "قبول الدعوة")}</button></div>)}</div>}
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{translate(locale, "Store team", "فريق المتجر")}</h2><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div>
          {!stores.length ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No stores are available in your account.", "لا توجد متاجر متاحة في حسابك.")}</p> : <>
            {selectedStore?.isOwner && <form onSubmit={invite} className="mt-5 grid gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 sm:grid-cols-[1fr_auto] sm:items-end"><label className="grid gap-2 text-sm font-medium">{translate(locale, "Existing user ID", "معرّف مستخدم حالي")}<input required value={userId} onChange={(event) => setUserId(event.target.value)} placeholder={translate(locale, "Paste the account user ID", "الصق معرّف مستخدم الحساب")} className="rounded-lg border border-[var(--border)] px-3 py-2.5 font-normal" /></label><button disabled={busy || !userId.trim()} className="rounded-lg bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{translate(locale, "Invite member", "دعوة عضو")}</button><p className="text-xs text-[var(--muted)] sm:col-span-2">{translate(locale, "Invitations are currently sent to existing active accounts using their account ID.", "تُرسل الدعوات حاليًا إلى الحسابات النشطة الموجودة باستخدام معرّف الحساب.")}</p></form>}
            <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3 pr-3">{translate(locale, "Member", "العضو")}</th><th className="py-3 pr-3">{translate(locale, "Status", "الحالة")}</th><th className="py-3 pr-3">{translate(locale, "Invited", "تاريخ الدعوة")}</th><th className="py-3">{translate(locale, "Action", "الإجراء")}</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-3"><p className="font-medium">{member.user.displayName ?? member.user.email}</p><p className="text-xs text-[var(--muted)]">{member.user.email}</p></td><td className="py-3 pr-3">{translate(locale, member.status, member.status === "INVITED" ? "مدعو" : member.status === "ACTIVE" ? "نشط" : "ملغى")}</td><td className="py-3 pr-3">{new Date(member.invitedAt).toLocaleDateString()}</td><td className="py-3">{selectedStore?.isOwner && member.status !== "REVOKED" ? <button disabled={busy} onClick={() => void action(`/api/stores/staff-memberships/${encodeURIComponent(member.id)}/revoke`, translate(locale, "Store access revoked.", "تم إلغاء إمكانية الوصول إلى المتجر."))} className="text-xs font-semibold text-red-700 disabled:opacity-50">{translate(locale, "Revoke access", "إلغاء الوصول")}</button> : "—"}</td></tr>)}</tbody></table>{!staff.length && <p className="py-6 text-sm text-[var(--muted)]">{translate(locale, "No staff memberships for this store yet.", "لا توجد عضويات فريق لهذا المتجر بعد.")}</p>}</div>
          </>}
        </section>
      </div>
    </main>
  );
}
