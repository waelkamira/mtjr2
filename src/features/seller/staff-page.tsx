"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Store = { id: string; name: string; slug: string; isOwner: boolean };
type Workspace = { stores: Store[] };
type Staff = {
  id: string; status: "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED"; invitedAt: string; expiresAt: string | null; acceptedAt: string | null; role: { key: string; name: string } | null;
  user: { id: string; email: string; displayName: string | null };
  invitedBy: { id: string; email: string; displayName: string | null } | null;
};
type Invitation = {
  id: string; invitedAt: string; expiresAt: string | null; store: { id: string; name: string; slug: string };
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleKey, setInviteRoleKey] = useState("STORE_CATALOG_MANAGER");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reloadSequence = useRef(0);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const loadStaff = useCallback(async (id: string, canManage: boolean, isCurrent: () => boolean) => {
    if (!id || !canManage) { if (isCurrent()) setStaff([]); return; }
    const result = await json<{ items: Staff[] }>(await fetch(`/api/stores/${encodeURIComponent(id)}/staff`, { cache: "no-store" }), translate(locale, "Unable to load store staff.", "تعذر تحميل فريق المتجر."));
    if (isCurrent()) {
      setStaff(result.items);
      setRoleDrafts(Object.fromEntries(result.items.map((member) => [member.id, member.role?.key ?? "STORE_MANAGER"])));
    }
  }, [locale]);

  const reload = useCallback(async () => {
    const sequence = ++reloadSequence.current;
    const isCurrent = () => reloadSequence.current === sequence;
    const [workspace, inbox] = await Promise.all([
      json<Workspace>(await fetch("/api/seller/stores", { cache: "no-store" }), translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر.")),
      json<{ items: Invitation[] }>(await fetch("/api/stores/staff-invitations", { cache: "no-store" }), translate(locale, "Unable to load invitations.", "تعذر تحميل الدعوات."))
    ]);
    if (!isCurrent()) return;
    setStores(workspace.stores);
    setInvitations(inbox.items);
    let savedId = "";
    try { savedId = localStorage.getItem("mtjr.activeStoreId") || ""; } catch { /* Keep team management usable when browser storage is blocked. */ }
    const nextId = workspace.stores.some((store) => store.id === storeId) ? storeId : workspace.stores.find((store) => store.id === savedId)?.id ?? workspace.stores[0]?.id ?? "";
    if (!isCurrent()) return;
    setStoreId(nextId);
    if (nextId) { try { localStorage.setItem("mtjr.activeStoreId", nextId); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Store selection still works for this session. */ } }
    const nextStore = workspace.stores.find((store) => store.id === nextId);
    await loadStaff(nextId, Boolean(nextStore?.isOwner), isCurrent);
  }, [loadStaff, storeId, locale]);

  useEffect(() => { Promise.resolve().then(() => reload()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load staff workspace.", "تعذر تحميل مساحة إدارة الفريق."))); }, [reload, locale]);

  async function action(path: string, success: string, method = "POST", body?: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      await json(await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }), translate(locale, "Request failed.", "فشل الطلب."));
      setMessage(success);
      toast.success(success);
      await reload();
      return true;
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Request failed.", "فشل الطلب."); setError(message); toast.error(message); return false; }
    finally { setBusy(false); }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) return;
    void action(`/api/stores/${encodeURIComponent(storeId)}/staff`, translate(locale, "Invitation created.", "تم إنشاء الدعوة."), "POST", { email: inviteEmail, roleKey: inviteRoleKey }).then((success) => { if (success) setInviteEmail(""); });
  }

  const selectedStore = stores.find((store) => store.id === storeId);

  return (
    <main className="min-h-screen bg-transparent">
      
      <div className="mx-auto max-w-[1440px] px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a94308]">{translate(locale, "Store access", "إمكانية الوصول إلى المتجر")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#454545]">{translate(locale, "Team & invitations", "الفريق والدعوات")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{translate(locale, "Store owners invite and revoke active accounts; invited users accept their own invitations. Every action is scoped to the selected store.", "مالك المتجر يدعو الحسابات النشطة ويلغي عضويتها؛ ويقبل المدعوون دعواتهم بأنفسهم. كل إجراء مرتبط بالمتجر المحدد.")}</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[#454545]">{message}</p>}

        <section className="mt-8 rounded-[1.8rem] border border-[#eee9e4] bg-white p-6 shadow-[0_8px_22px_rgba(69,69,69,.06)]">
          <h2 className="text-lg font-semibold">{translate(locale, "Your invitations", "دعواتك")}</h2>
          {!invitations.length ? <p className="mt-3 text-sm text-[var(--muted)]">{translate(locale, "You have no pending store invitations.", "ليس لديك دعوات متجر معلقة.")}</p> : <div className="mt-4 grid gap-3">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-4"><div><p className="font-medium">{invitation.store.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Invited by", "بدعوة من")} {invitation.invitedBy?.displayName ?? invitation.invitedBy?.email ?? translate(locale, "Store owner", "مالك المتجر")}</p><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Expires", "تنتهي")} {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleString() : translate(locale, "No expiry", "بلا انتهاء")}</p></div><button disabled={busy} onClick={() => void action(`/api/stores/staff-invitations/${encodeURIComponent(invitation.id)}/accept`, translate(locale, "Invitation accepted.", "تم قبول الدعوة."))} className="rounded-lg bg-[var(--color-ink-800)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{translate(locale, "Accept invitation", "قبول الدعوة")}</button></div>)}</div>}
        </section>

        <section className="mt-6 rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-6 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white,inset_0_-2px_6px_rgba(119,86,62,.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{translate(locale, "Store team", "فريق المتجر")}</h2><select value={storeId} onChange={(event) => { reloadSequence.current += 1; setStaff([]); setStoreId(event.target.value); try { localStorage.setItem("mtjr.activeStoreId", event.target.value); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Store selection still works for this session. */ } }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div>
          {!stores.length ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No stores are available in your account.", "لا توجد متاجر متاحة في حسابك.")}</p> : !selectedStore?.isOwner ? <p className="mt-4 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm leading-6 text-[var(--muted)]">{translate(locale, "Only the store owner can invite or revoke team members for now. You can still accept invitations addressed to you above.", "مالك المتجر وحده يستطيع حاليًا دعوة أعضاء الفريق أو إلغاء عضويتهم. يمكنك قبول الدعوات الموجهة إليك أعلاه.")}</p> : <>
            <form onSubmit={invite} className="mt-5 grid gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"><label className="grid gap-2 text-sm font-medium">{translate(locale, "Account email", "البريد الإلكتروني للحساب")}<input required type="email" autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={translate(locale, "member@example.com", "member@example.com")} className="rounded-lg border border-[var(--border)] px-3 py-2.5 font-normal" /></label><label className="grid gap-2 text-sm font-medium">{translate(locale, "Access role", "دور الوصول")}<select value={inviteRoleKey} onChange={(event) => setInviteRoleKey(event.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2.5 font-normal"><option value="STORE_CATALOG_MANAGER">{translate(locale, "Catalog manager", "مدير المنتجات")}</option><option value="STORE_INVENTORY_MANAGER">{translate(locale, "Inventory manager", "مدير المخزون")}</option><option value="STORE_ORDER_MANAGER">{translate(locale, "Order manager", "مدير الطلبات")}</option><option value="STORE_CUSTOMER_CARE">{translate(locale, "Customer care", "خدمة العملاء")}</option><option value="STORE_MARKETING_MANAGER">{translate(locale, "Marketing manager", "مدير التسويق")}</option><option value="STORE_MANAGER">{translate(locale, "Full store manager", "مدير المتجر الكامل")}</option></select></label><button disabled={busy || !inviteEmail.trim()} className="rounded-lg bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{translate(locale, "Invite member", "دعوة عضو")}</button><p className="text-xs text-[var(--muted)] sm:col-span-2">{translate(locale, "Invitations are sent to existing active accounts by email. The selected store-scoped role is applied when the recipient accepts in their seller workspace. Invitations expire after seven days and can be renewed.", "تُرسل الدعوات إلى الحسابات النشطة الموجودة عبر البريد الإلكتروني. يُطبّق دور الوصول المحدد ضمن نطاق المتجر عند قبول المدعو للدعوة من مساحة البائع. تنتهي صلاحية الدعوة بعد سبعة أيام ويمكن تجديدها.")}</p></form>
            <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="py-3 pr-3">{translate(locale, "Member", "العضو")}</th><th className="py-3 pr-3">{translate(locale, "Status", "الحالة")}</th><th className="py-3 pr-3">{translate(locale, "Role", "الدور")}</th><th className="py-3 pr-3">{translate(locale, "Invited", "تاريخ الدعوة")}</th><th className="py-3">{translate(locale, "Action", "الإجراء")}</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id} className="border-b border-[var(--border)] last:border-0"><td className="py-3 pr-3"><p className="font-medium">{member.user.displayName ?? member.user.email}</p><p className="text-xs text-[var(--muted)]">{member.user.email}</p></td><td className="py-3 pr-3"><StatusBadge locale={locale} status={member.status === "INVITED" && member.expiresAt && currentTime !== null && new Date(member.expiresAt).getTime() <= currentTime ? "EXPIRED" : member.status} /><p className="mt-1 text-xs text-[var(--muted)]">{member.status === "INVITED" && member.expiresAt ? `${translate(locale, "Expires", "تنتهي")}: ${new Date(member.expiresAt).toLocaleDateString()}` : member.acceptedAt ? `${translate(locale, "Accepted", "قُبلت")}: ${new Date(member.acceptedAt).toLocaleDateString()}` : ""}</p></td><td className="py-3 pr-3"><div className="flex min-w-[190px] flex-col items-start gap-2"><select aria-label={translate(locale, "Member access role", "دور وصول العضو")} value={roleDrafts[member.id] ?? member.role?.key ?? "STORE_MANAGER"} onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: event.target.value }))} disabled={busy || member.status === "REVOKED" || member.status === "SUSPENDED"} className="max-w-full rounded-lg border border-[var(--border)] bg-white/70 px-2 py-1.5 text-xs"><option value="STORE_CATALOG_MANAGER">{translate(locale, "Catalog manager", "مدير المنتجات")}</option><option value="STORE_INVENTORY_MANAGER">{translate(locale, "Inventory manager", "مدير المخزون")}</option><option value="STORE_ORDER_MANAGER">{translate(locale, "Order manager", "مدير الطلبات")}</option><option value="STORE_CUSTOMER_CARE">{translate(locale, "Customer care", "خدمة العملاء")}</option><option value="STORE_MARKETING_MANAGER">{translate(locale, "Marketing manager", "مدير التسويق")}</option><option value="STORE_MANAGER">{translate(locale, "Full store manager", "مدير المتجر الكامل")}</option></select>{member.status !== "REVOKED" && (roleDrafts[member.id] ?? member.role?.key ?? "STORE_MANAGER") !== (member.role?.key ?? "STORE_MANAGER") ? <button type="button" disabled={busy} onClick={() => void action(`/api/stores/staff-memberships/${encodeURIComponent(member.id)}`, translate(locale, "Access role updated.", "تم تحديث دور الوصول."), "PATCH", { roleKey: roleDrafts[member.id] })} className="text-xs font-bold text-[var(--color-forest-900)] disabled:opacity-50">{translate(locale, "Save role", "حفظ الدور")}</button> : null}</div></td><td className="py-3 pr-3">{new Date(member.invitedAt).toLocaleDateString()}</td><td className="py-3">{member.status === "INVITED" && member.expiresAt && currentTime !== null && new Date(member.expiresAt).getTime() <= currentTime ? <button disabled={busy} onClick={() => void action(`/api/stores/${encodeURIComponent(storeId)}/staff`, translate(locale, "Invitation renewed for seven days.", "تم تجديد الدعوة لمدة سبعة أيام."), "POST", { email: member.user.email, roleKey: member.role?.key ?? "STORE_MANAGER" })} className="mr-3 text-xs font-semibold text-[var(--color-forest-900)] disabled:opacity-50">{translate(locale, "Resend invitation", "إعادة إرسال الدعوة")}</button> : null}{member.status !== "REVOKED" ? <button disabled={busy} onClick={() => void action(`/api/stores/staff-memberships/${encodeURIComponent(member.id)}/revoke`, translate(locale, "Store access revoked.", "تم إلغاء إمكانية الوصول إلى المتجر."))} className="text-xs font-semibold text-red-700 disabled:opacity-50">{translate(locale, "Revoke access", "إلغاء الوصول")}</button> : "—"}</td></tr>)}</tbody></table>{!staff.length && <p className="py-6 text-sm text-[var(--muted)]">{translate(locale, "No staff memberships for this store yet.", "لا توجد عضويات فريق لهذا المتجر بعد.")}</p>}</div>
          </>}
        </section>
      </div>
    </main>
  );
}
