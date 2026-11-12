"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type UserDetail = {
  id: string; email: string; displayName: string | null; status: string; anonymizedAt: string | null;
  permissions: { canManageRoles: boolean; canAnonymize: boolean; mfaRequired: boolean };
  twoFactor: { enabledAt: string | null };
  roleAssignableStores: Array<{ id: string; name: string; status: string }>;
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
  roleAssignments: Array<{ id: string; scopeType: string; scopeId: string; assignedAt: string; expiresAt: string | null; role: { key: string; name: string; permissions: Array<{ permission: { key: string } }> } }>;
  sessions: Array<{ id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; expiresAt: string; revokedAt: string | null }>;
  consents: Array<{ id: string; type: string; version: string; granted: boolean; source: string | null; capturedAt: string }>;
  loginAttempts: Array<{ id: string; succeeded: boolean; attemptedAt: string }>;
  auditEvents: Array<{ id: string; action: string; actorId: string | null; occurredAt: string }>;
  counts: { orders: number; sessions: number; loginAttempts: number; consents: number };
};
type DelegableRole = { key: string; name: string; description: string | null; requiredScopeType: "STORE" | null };
const statuses = ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"];

export default function AdminUserDetailPage({ userId }: { userId: string }) {
  const { locale } = useLocale();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [delegableRoles, setDelegableRoles] = useState<DelegableRole[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [roleBusy, setRoleBusy] = useState("");
  const [deletionEmail, setDeletionEmail] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
    const data = await response.json() as { user?: UserDetail; error?: string };
    if (!response.ok || !data.user) throw new Error(data.error || translate(locale, "User profile unavailable.", "ملف المستخدم غير متاح."));
    setUser(data.user);
    setStatus(data.user.status);
    if (data.user.permissions.canManageRoles && data.user.status === "ACTIVE" && !data.user.anonymizedAt) {
      const roleResponse = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/roles`, { cache: "no-store" });
      const roleData = await roleResponse.json() as { roles?: DelegableRole[]; error?: string };
      if (!roleResponse.ok) throw new Error(roleData.error || translate(locale, "Assignable roles unavailable.", "الأدوار القابلة للإسناد غير متاحة."));
      setDelegableRoles(roleData.roles || []);
      setSelectedRole((current) => current || roleData.roles?.[0]?.key || "");
      setSelectedStoreId((current) => current || data.user?.roleAssignableStores[0]?.id || "");
    } else {
      setDelegableRoles([]);
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
        const data = await response.json() as { user?: UserDetail; error?: string };
        if (!response.ok || !data.user) throw new Error(data.error || translate(locale, "User profile unavailable.", "ملف المستخدم غير متاح."));
        if (active) { setUser(data.user); setStatus(data.user.status); }
        if (data.user.permissions.canManageRoles && data.user.status === "ACTIVE" && !data.user.anonymizedAt) {
          const roleResponse = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/roles`, { cache: "no-store" });
          const roleData = await roleResponse.json() as { roles?: DelegableRole[]; error?: string };
          if (!roleResponse.ok) throw new Error(roleData.error || translate(locale, "Assignable roles unavailable.", "الأدوار القابلة للإسناد غير متاحة."));
          if (active) {
            setDelegableRoles(roleData.roles || []);
            setSelectedRole((current) => current || roleData.roles?.[0]?.key || "");
            setSelectedStoreId((current) => current || data.user?.roleAssignableStores[0]?.id || "");
          }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "User profile unavailable.", "ملف المستخدم غير متاح."));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, userId]);

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
      setMessage(translate(locale, "Account status updated.", "تم تحديث حالة الحساب.") + ` ${data.result?.revokedSessions ?? 0} ` + translate(locale, "active session(s) revoked.", "جلسة نشطة تم إبطالها."));
      await load();
      toast.success(translate(locale, "Account status updated.", "تم تحديث حالة الحساب."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Account status update failed.", "تعذر تحديث حالة الحساب."); setError(message); toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function assignRole() {
    if (!selectedRole || !user) return;
    const role = delegableRoles.find((item) => item.key === selectedRole);
    const store = role?.requiredScopeType === "STORE"
      ? user.roleAssignableStores.find((item) => item.id === selectedStoreId)
      : undefined;
    if (!role || (role.requiredScopeType && !store)) return;
    const assignmentScope = role.requiredScopeType
      ? { type: role.requiredScopeType, id: selectedStoreId }
      : undefined;
    if (!window.confirm(`Assign ${role.name}${store ? ` for ${store.name}` : ""} to ${user.email}?`)) return;
    setRoleBusy(selectedRole); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey: selectedRole, ...(assignmentScope ? { scope: assignmentScope } : {}) })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Role assignment failed.");
      setMessage(`${role.name} ${translate(locale, "assigned. The change was recorded in the platform audit log.", "تم إسناده. سُجّل التغيير في سجل تدقيق المنصة.")}`);
      await load();
      toast.success(translate(locale, "Role assigned.", "تم إسناد الدور."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Role assignment failed.", "تعذر إسناد الدور."); setError(message); toast.error(message);
    } finally {
      setRoleBusy("");
    }
  }

  async function revokeRole(assignment: UserDetail["roleAssignments"][number]) {
    if (!user || !window.confirm(`Remove ${assignment.role.name} from this account?`)) return;
    setRoleBusy(assignment.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Role removal failed.");
      setMessage(`${assignment.role.name} ${translate(locale, "removed. The change was recorded in the platform audit log.", "تمت إزالته. سُجّل التغيير في سجل تدقيق المنصة.")}`);
      await load();
      toast.success(translate(locale, "Role removed.", "تمت إزالة الدور."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Role removal failed.", "تعذرت إزالة الدور."); setError(message); toast.error(message);
    } finally {
      setRoleBusy("");
    }
  }

  async function anonymizeAccount() {
    if (!user || deletionEmail.trim().toLocaleLowerCase() !== user.email.toLocaleLowerCase() || deletionReason.trim().length < 5) return;
    if (!window.confirm(`${translate(locale, "Anonymize", "إخفاء هوية")} ${user.email}? ${translate(locale, "This cannot be undone. Orders, payments, return cases, and audit records will be retained; the store and products will be removed from public view.", "لا يمكن التراجع عن هذا الإجراء. سيتم الاحتفاظ بالطلبات والمدفوعات وحالات الإرجاع وسجلات التدقيق، وستتم إزالة المتجر والمنتجات من العرض العام.")}`)) return;
    setDeleting(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail: deletionEmail, reason: deletionReason })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Account anonymization failed.", "تعذرت إزالة هوية الحساب."));
      setMessage(translate(locale, "Account anonymized. Store and product visibility was removed; financial, order, and audit records were preserved.", "تم إخفاء هوية الحساب وإزالة ظهور المتجر والمنتجات؛ وتم الاحتفاظ بالسجلات المالية وسجلات الطلبات والتدقيق."));
      setDeletionEmail(""); setDeletionReason("");
      await load();
      toast.success(translate(locale, "Account anonymized.", "تم إخفاء هوية الحساب."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Account anonymization failed.", "تعذرت إزالة هوية الحساب."); setError(message); toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <main className="min-h-screen px-5 py-8"><div className="mx-auto h-48 max-w-5xl animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /></main>;
  if (!user) return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-5xl"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error || translate(locale, "User not found.", "المستخدم غير موجود.")}</p><Link href="/admin/users" className="mt-4 inline-block underline">{translate(locale, "Back to users", "العودة إلى المستخدمين")}</Link></div></main>;

  const protectedAdmin = user.roleAssignments.some((assignment) =>
    assignment.role.key === "SUPER_ADMIN" ||
    assignment.role.permissions.some(({ permission }) => permission.key === "platform:manage")
  );
  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/users" className="text-sm font-semibold text-[var(--color-copper-600)] underline">← {translate(locale, "Users", "المستخدمون")}</Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Account administration", "إدارة الحساب")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{user.displayName || user.email}</h1><p className="mt-1 text-sm text-[var(--muted)]">{user.email} · {user.id}</p></div><StatusBadge locale={locale} status={user.status} /></header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Info label={translate(locale, "Last sign-in", "آخر تسجيل دخول")} value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : translate(locale, "Never", "أبدًا")} />
        <Info label={translate(locale, "Account created", "تاريخ إنشاء الحساب")} value={new Date(user.createdAt).toLocaleString()} />
        <Info label={translate(locale, "Related orders", "الطلبات المرتبطة")} value={String(user.counts.orders)} />
      </section>
      {user.anonymizedAt && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{translate(locale, "Account anonymized on", "تم إخفاء هوية الحساب في")} {new Date(user.anonymizedAt).toLocaleString()}{translate(locale, ". Orders, payments, support, and audit records remain retained.", ". وستظل سجلات الطلبات والمدفوعات والدعم والتدقيق محفوظة.")}</p>}
      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold">{translate(locale, "Account status", "حالة الحساب")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Suspending or disabling revokes active sessions. Re-activation does not restore sessions.", "يؤدي تعليق الحساب أو تعطيله إلى إبطال الجلسات النشطة. إعادة التفعيل لا تستعيد الجلسات.")}</p>
        {user.anonymizedAt ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{translate(locale, "Anonymized accounts cannot be reactivated or edited.", "لا يمكن إعادة تفعيل الحسابات مجهولة الهوية أو تعديلها.")}</p> : protectedAdmin ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{translate(locale, "Super administrator accounts are protected from status changes.", "حسابات المشرف الأعلى محمية من تغيير الحالة.")}</p> : <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "New status", "الحالة الجديدة")}<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]">{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Required administrative reason", "سبب إداري مطلوب")}<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <button disabled={busy || status === user.status || reason.trim().length < 5} onClick={() => void changeStatus()} className="self-end rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Update status", "تحديث الحالة")}</button>
        </div>}
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title={`${translate(locale, "Role assignments", "تعيينات الأدوار")} (${user.roleAssignments.length})`}>
          {user.roleAssignments.length ? user.roleAssignments.map((assignment) => <div key={assignment.id} className="flex items-start justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><div><p className="font-semibold">{assignment.role.name} <span className="text-xs font-normal text-[var(--muted)]">{assignment.role.key}</span></p><p className="mt-1 text-xs text-[var(--muted)]">{assignment.scopeType}: {assignment.scopeId} · {translate(locale, "assigned", "أُسند في")} {new Date(assignment.assignedAt).toLocaleDateString()}{assignment.expiresAt ? ` · ${translate(locale, "expires", "ينتهي في")} ${new Date(assignment.expiresAt).toLocaleDateString()}` : ""}</p></div>{user.permissions.canManageRoles && !protectedAdmin && <button disabled={roleBusy === assignment.id} onClick={() => void revokeRole(assignment)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">{roleBusy === assignment.id ? translate(locale, "Removing…", "جارٍ الإزالة…") : translate(locale, "Remove", "إزالة")}</button>}</div>) : <p className="text-sm text-[var(--muted)]">{translate(locale, "No assigned roles.", "لا توجد أدوار مسندة.")}</p>}
          {user.permissions.canManageRoles && user.status === "ACTIVE" && !user.anonymizedAt && !protectedAdmin && <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-4"><label className="min-w-48 flex-1 text-xs font-medium text-[var(--muted)]">{translate(locale, "Assign role", "إسناد دور")}<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]">{delegableRoles.map((role) => <option key={role.key} value={role.key}>{role.name} ({role.key})</option>)}</select></label>{delegableRoles.find((role) => role.key === selectedRole)?.requiredScopeType === "STORE" && <label className="min-w-48 flex-1 text-xs font-medium text-[var(--muted)]">{translate(locale, "Store scope", "نطاق المتجر")}<select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{translate(locale, "Select an active store membership", "اختر عضوية نشطة في متجر")}</option>{user.roleAssignableStores.map((store) => <option key={store.id} value={store.id}>{store.name} ({store.status})</option>)}</select></label>}<button disabled={roleBusy !== "" || !selectedRole || (delegableRoles.find((role) => role.key === selectedRole)?.requiredScopeType === "STORE" && (!selectedStoreId || user.roleAssignments.some((assignment) => assignment.role.key === selectedRole && assignment.scopeType === "STORE" && assignment.scopeId === selectedStoreId)))} onClick={() => void assignRole()} className="rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-500/20 transition hover:bg-[#F57C00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{roleBusy === selectedRole ? translate(locale, "Assigning…", "جارٍ الإسناد…") : translate(locale, "Assign role", "إسناد دور")}</button>{delegableRoles.find((role) => role.key === selectedRole)?.requiredScopeType === "STORE" && user.roleAssignableStores.length === 0 && <p className="w-full text-xs text-[var(--muted)]">{translate(locale, "This account has no active store memberships. Add the user to a store before granting a store-scoped manager role.", "لا توجد لهذا الحساب عضويات نشطة في متاجر. أضف المستخدم إلى متجر قبل منحه دور مدير بنطاق المتجر.")}</p>}</div>}
          {!user.permissions.canManageRoles && <p className="mt-3 text-xs text-[var(--muted)]">{translate(locale, "Role changes require the roles:assign permission. Protected platform roles cannot be assigned here.", "يتطلب تغيير الأدوار صلاحية roles:assign. لا يمكن إسناد أدوار المنصة المحمية من هنا.")}</p>}
        </Panel>
        <Panel title={`${translate(locale, "Recent sessions", "الجلسات الأخيرة")} (${user.counts.sessions} ${translate(locale, "total", "إجماليًا")})`}>
          {user.sessions.length ? user.sessions.map((session) => <div key={session.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold"><StatusBadge locale={locale} status={session.revokedAt ? "REVOKED" : session.expiresAt < new Date().toISOString() ? "EXPIRED" : "ACTIVE"} /> · {session.ipAddress || translate(locale, "IP unavailable", "عنوان IP غير متاح")}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.userAgent || translate(locale, "Device information unavailable", "معلومات الجهاز غير متاحة")}</p><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Last seen", "آخر ظهور")} {new Date(session.lastSeenAt).toLocaleString()} · {translate(locale, "expires", "تنتهي")} {new Date(session.expiresAt).toLocaleString()}</p></div>) : <p className="text-sm text-[var(--muted)]">{translate(locale, "No sessions recorded.", "لا توجد جلسات مسجلة.")}</p>}
        </Panel>
        <Panel title={`${translate(locale, "Consent history", "سجل الموافقات")} (${user.counts.consents} ${translate(locale, "total", "إجماليًا")})`}>
          {user.consents.length ? user.consents.map((consent) => <div key={consent.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold">{consent.type.replaceAll("_", " ")} · {consent.granted ? translate(locale, "Granted", "ممنوحة") : translate(locale, "Withdrawn", "مسحوبة")}</p><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Version", "الإصدار")} {consent.version} · {consent.source || translate(locale, "source unavailable", "المصدر غير متاح")} · {new Date(consent.capturedAt).toLocaleString()}</p></div>) : <p className="text-sm text-[var(--muted)]">{translate(locale, "No consent records.", "لا توجد سجلات موافقة.")}</p>}
        </Panel>
        <Panel title={`${translate(locale, "Recent login attempts", "محاولات تسجيل الدخول الأخيرة")} (${user.counts.loginAttempts} ${translate(locale, "total", "إجماليًا")})`}>
          {user.loginAttempts.length ? user.loginAttempts.map((attempt) => <div key={attempt.id} className="flex justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><span className={attempt.succeeded ? "text-emerald-800" : "text-rose-700"}>{attempt.succeeded ? translate(locale, "Successful", "ناجحة") : translate(locale, "Failed", "فاشلة")}</span><time className="text-xs text-[var(--muted)]">{new Date(attempt.attemptedAt).toLocaleString()}</time></div>) : <p className="text-sm text-[var(--muted)]">{translate(locale, "No attempts recorded.", "لا توجد محاولات مسجلة.")}</p>}
        </Panel>
        <Panel title={translate(locale, "Administrative activity", "النشاط الإداري")}>
          {user.auditEvents.length ? user.auditEvents.map((event) => <div key={event.id} className="border-b border-[var(--border)] py-3 last:border-0"><p className="font-semibold">{event.action.replaceAll(".", " ")}</p><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Actor", "المنفّذ")} {event.actorId || "system"} · {new Date(event.occurredAt).toLocaleString()}</p></div>) : <p className="text-sm text-[var(--muted)]">{translate(locale, "No administrative events recorded for this account.", "لا توجد أحداث إدارية مسجلة لهذا الحساب.")}</p>}
        </Panel>
      </section>
      <Panel title={translate(locale, "Multi-factor authentication", "المصادقة متعددة العوامل")}>
        <p className="text-sm text-[var(--muted)]">{user.twoFactor.enabledAt ? `${translate(locale, "Authenticator MFA enabled", "تم تفعيل المصادقة متعددة العوامل عبر تطبيق المصادقة")} ${new Date(user.twoFactor.enabledAt).toLocaleDateString()}.` : translate(locale, "Authenticator MFA is not enabled for this account.", "المصادقة متعددة العوامل عبر تطبيق المصادقة غير مفعلة لهذا الحساب.")} {user.permissions.mfaRequired ? translate(locale, "MFA enrollment is enforced for this administrator or seller account.", "التسجيل في المصادقة متعددة العوامل إلزامي لهذا الحساب الإداري أو حساب البائع.") : translate(locale, "MFA is optional for this account.", "المصادقة متعددة العوامل اختيارية لهذا الحساب.")}</p>
      </Panel>
      {user.permissions.canAnonymize && !protectedAdmin && !user.anonymizedAt && <section className="mt-6 rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-red-800">{translate(locale, "Anonymize account", "إخفاء هوية الحساب")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "This disables sign-in, removes identity and credentials, closes the seller’s stores, archives products, and hides authored reviews and Q&A. Orders, payments, support cases, tax records, and audit history are retained. This cannot be undone.", "سيؤدي هذا إلى تعطيل تسجيل الدخول وإزالة الهوية وبيانات الاعتماد وإغلاق متاجر البائع وأرشفة المنتجات وإخفاء المراجعات والأسئلة والأجوبة التي نشرها. ستظل الطلبات والمدفوعات وحالات الدعم والسجلات الضريبية وسجل التدقيق محفوظة. لا يمكن التراجع عن هذا الإجراء.")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Type the account email to confirm", "اكتب البريد الإلكتروني للحساب للتأكيد")}<input value={deletionEmail} onChange={(event) => setDeletionEmail(event.target.value)} autoComplete="off" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Required reason", "السبب مطلوب")}<input value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} minLength={5} maxLength={500} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <button disabled={deleting || deletionEmail.trim().toLocaleLowerCase() !== user.email.toLocaleLowerCase() || deletionReason.trim().length < 5} onClick={() => void anonymizeAccount()} className="self-end rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{deleting ? translate(locale, "Anonymizing…", "جارٍ إخفاء الهوية…") : translate(locale, "Anonymize account", "إخفاء هوية الحساب")}</button>
        </div>
      </section>}
    </div>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 font-semibold">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-white p-5"><h2 className="mb-3 text-lg font-semibold">{title}</h2>{children}</section>;
}
