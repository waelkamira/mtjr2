"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

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
  const { locale } = useLocale();
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
    if (!response.ok) throw new Error(data.error || translate(locale, "Unable to load requests.", "تعذر تحميل الطلبات."));
    setRequests(data.requests || []);
  }, [locale]);

  useEffect(() => {
    void Promise.resolve().then(() => load())
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load requests.", "تعذر تحميل الطلبات.")))
      .finally(() => setLoading(false));
  }, [load, locale]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/control-panel/privilege-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Unable to submit request.", "تعذر إرسال الطلب."));
      setEmail(""); setReason(""); setNotice(translate(locale, "Privilege request submitted for independent review.", "تم إرسال طلب الامتياز للمراجعة المستقلة."));
      await load();
      toast.success(translate(locale, "Privilege request submitted.", "تم إرسال طلب الصلاحيات."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to submit request.", "تعذر إرسال الطلب."); setError(message); toast.error(message);
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
      if (!response.ok) throw new Error(data.error || translate(locale, "Unable to process decision.", "تعذرت معالجة القرار."));
      setNotice(decision === "APPROVE" ? translate(locale, "Request approved; platform access was granted.", "تمت الموافقة على الطلب ومنح صلاحية الوصول إلى المنصة.") : translate(locale, "Request rejected.", "تم رفض الطلب."));
      await load();
      toast.success(translate(locale, "Privilege decision saved.", "تم حفظ قرار الصلاحيات."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Unable to process decision.", "تعذرت معالجة القرار."); setError(message); toast.error(message);
    } finally { setSaving(false); }
  }

  const pending = requests.filter((request) => request.status === "PENDING");
  const history = requests.filter((request) => request.status !== "PENDING");

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/control-panel" className="text-sm font-medium text-[var(--color-copper-600)] hover:underline">← {translate(locale, "Platform control panel", "لوحة تحكم المنصة")}</Link>
        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Security & governance", "الأمن والحوكمة")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Super Admin privilege approvals", "الموافقة على امتيازات المشرف الأعلى")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{translate(locale, "A two-person control for granting platform-wide access. Neither the requester nor the target can approve or reject the request; approvals grant only the canonical SUPER_ADMIN role.", "آلية موافقة من شخصين لمنح صلاحية الوصول على مستوى المنصة. لا يمكن لمقدم الطلب أو المستخدم المستهدف الموافقة على الطلب أو رفضه؛ وتمنح الموافقة دور SUPER_ADMIN الرسمي فقط.")}</p>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--color-forest-950)]">{notice}</p>}

        <form onSubmit={submitRequest} className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div><h2 className="font-semibold text-[var(--color-forest-950)]">{translate(locale, "Request platform access for a user", "طلب صلاحية الوصول إلى المنصة لمستخدم")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Target must be an existing active account. A different Super Admin who is neither requester nor target must review this request.", "يجب أن يكون الحساب المستهدف موجودًا ونشطًا. يجب أن يراجعه مشرف أعلى آخر ليس مقدم الطلب ولا المستخدم المستهدف.")}</p></div>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "User email", "البريد الإلكتروني للمستخدم")}<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)]" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Business justification", "مبررات العمل")}<textarea required minLength={20} maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={translate(locale, "Explain why this person needs platform-wide management access…", "اشرح سبب حاجة هذا الشخص إلى صلاحيات الإدارة على مستوى المنصة…")} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)]" /></label>
          <button disabled={saving} className="justify-self-start rounded-xl bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F0780B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 disabled:opacity-60">{saving ? translate(locale, "Processing…", "جارٍ التنفيذ…") : translate(locale, "Submit access request", "إرسال طلب الوصول")}</button>
        </form>

        <section aria-busy={loading || saving} className="mt-8">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Pending review", "بانتظار المراجعة")}</h2><span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">{pending.length} {translate(locale, "pending", "قيد الانتظار")}</span></div>
          {loading ? <p className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">{translate(locale, "Loading requests…", "جارٍ تحميل الطلبات…")}</p> : pending.length === 0 ? <p className="mt-4 rounded-xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">{translate(locale, "No pending privilege requests.", "لا توجد طلبات امتياز بانتظار المراجعة.")}</p> : (
            <div className="mt-4 space-y-3">
              {pending.map((request) => <article key={request.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-[var(--color-forest-950)]">{request.targetUser.displayName || request.targetUser.email}</h3><p className="mt-1 text-sm text-[var(--muted)]">{request.targetUser.email} · <StatusBadge locale={locale} status={request.targetUser.status} /></p></div><span className="text-xs text-[var(--muted)]">{translate(locale, "Requested", "تاريخ الطلب")} {new Date(request.requestedAt).toLocaleString(locale)}</span></div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{request.reason}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">{translate(locale, "Requested by", "مقدم الطلب")} {request.requester.displayName || request.requester.email}</p>
                <label className="mt-4 block text-xs font-medium text-[var(--muted)]">{translate(locale, "Decision note (optional)", "ملاحظة القرار (اختياري)")}<textarea rows={2} maxLength={1000} value={decisionNote[request.id] || ""} onChange={(event) => setDecisionNote((current) => ({ ...current, [request.id]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void decide(request.id, "APPROVE")} className="rounded-xl bg-[#FF8C1C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{translate(locale, "Approve & grant access", "الموافقة ومنح الصلاحية")}</button><button disabled={saving} onClick={() => void decide(request.id, "REJECT")} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">{translate(locale, "Reject request", "رفض الطلب")}</button></div>
              </article>)}
            </div>
          )}
        </section>

        {history.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Decision history", "سجل القرارات")}</h2><div className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">{history.map((request) => <article key={request.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium">{request.targetUser.displayName || request.targetUser.email} · {request.targetUser.email}</div><StatusBadge locale={locale} status={request.status} /></div><p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, "Requested by", "مقدم الطلب")} {request.requester.email} · {translate(locale, "Reviewed by", "تمت مراجعته بواسطة")} {request.reviewer?.email || "—"} · {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString(locale) : "—"}</p>{request.decisionNote && <p className="mt-2 text-sm text-[var(--muted)]">{request.decisionNote}</p>}</article>)}</div></section>}
        <p className="mt-5 text-xs leading-5 text-[var(--muted)]">{translate(locale, "All decisions are recorded in the immutable audit history. This workflow does not expose revocation; emergency removal requires a separately designed break-glass process.", "تُسجل جميع القرارات في سجل التدقيق غير القابل للتغيير. لا يتيح هذا الإجراء إلغاء الصلاحية؛ وتتطلب الإزالة الطارئة إجراءً منفصلًا مصممًا لذلك.")}</p>
      </div>
    </main>
  );
}
