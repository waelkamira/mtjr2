"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type NotificationItem = {
  id: string; type: string; title: string; message: string;
  resourceType: string | null; resourceId: string | null; readAt: string | null; createdAt: string; deliveries?: { status: string; attempts: number; sentAt: string | null }[];
};
type NotificationPreference = {
  type: string; label: string; description: string; inAppEnabled: boolean; emailEnabled: boolean;
};
type EmailDeliveryItem = { id: string; type: string; title: string; status: string; attempts: number; sentAt: string | null; createdAt: string };

export default function NotificationsPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [emailDeliveries, setEmailDeliveries] = useState<EmailDeliveryItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const [notificationResponse, preferenceResponse] = await Promise.all([
      fetch("/api/notifications", { cache: "no-store" }),
      fetch("/api/account/notification-preferences", { cache: "no-store" })
    ]);
    const [notificationData, preferenceData] = await Promise.all([
      notificationResponse.json() as Promise<{ items?: NotificationItem[]; unreadCount?: number; emailDeliveries?: EmailDeliveryItem[]; error?: string }>,
      preferenceResponse.json() as Promise<{ preferences?: NotificationPreference[]; error?: string }>
    ]);
    if (!notificationResponse.ok) throw new Error(notificationData.error || t("Notifications could not be loaded.", "تعذّر تحميل الإشعارات."));
    if (!preferenceResponse.ok) throw new Error(preferenceData.error || t("Notification preferences could not be loaded.", "تعذّر تحميل تفضيلات الإشعارات."));
    setItems(notificationData.items || []);
    setUnreadCount(notificationData.unreadCount || 0);
    setEmailDeliveries(notificationData.emailDeliveries || []);
    setPreferences(preferenceData.preferences || []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/notifications", { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { items?: NotificationItem[]; unreadCount?: number; emailDeliveries?: EmailDeliveryItem[]; error?: string };
        if (!response.ok) throw new Error(data.error || t("Notifications could not be loaded.", "تعذّر تحميل الإشعارات."));
        if (active) { setItems(data.items || []); setUnreadCount(data.unreadCount || 0); setEmailDeliveries(data.emailDeliveries || []); }
      }),
      fetch("/api/account/notification-preferences", { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { preferences?: NotificationPreference[]; error?: string };
        if (!response.ok) throw new Error(data.error || t("Notification preferences could not be loaded.", "تعذّر تحميل تفضيلات الإشعارات."));
        if (active) setPreferences(data.preferences || []);
      })
    ]).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t("Notifications could not be loaded.", "تعذّر تحميل الإشعارات.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  async function markRead(id: string) {
    setBusyId(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Notification could not be updated.", "تعذّر تحديث الإشعار."));
      await load();
      toast.success(t("Notification marked as read.", "تم تحديد الإشعار كمقروء."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : t("Notification could not be updated.", "تعذّر تحديث الإشعار."); setError(message); toast.error(message); }
    finally { setBusyId(""); }
  }

  async function savePreferences() {
    setSavingPreferences(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account/notification-preferences", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: preferences.map(({ type, inAppEnabled, emailEnabled }) => ({ type, inAppEnabled, emailEnabled })) })
      });
      const data = await response.json() as { preferences?: NotificationPreference[]; error?: string };
      if (!response.ok) throw new Error(data.error || t("Notification preferences could not be saved.", "تعذّر حفظ تفضيلات الإشعارات."));
      setPreferences(data.preferences || []);
      setNotice(t("Your notification preferences have been saved.", "تم حفظ تفضيلات الإشعارات."));
      toast.success(t("Notification preferences saved.", "تم حفظ تفضيلات الإشعارات."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : t("Notification preferences could not be saved.", "تعذّر حفظ تفضيلات الإشعارات."); setError(message); toast.error(message); }
    finally { setSavingPreferences(false); }
  }

  function href(item: NotificationItem) {
    if (item.resourceType === "ORDER" && item.resourceId) return `/orders/${item.resourceId}`;
    if (item.resourceType === "VENDOR_ORDER") return "/seller/orders";
    if (item.resourceType === "store_conversation" && item.resourceId) return `/account/messages/${item.resourceId}`;
    if (item.resourceType === "support_ticket" && item.resourceId) return `/account/support/${item.resourceId}`;
    return "/notifications";
  }

  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-4 sm:px-5 sm:py-5"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/account/profile" className="text-sm">{t("My account", "حسابي")}</Link></div></header>
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-5 sm:py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{t("Account updates", "تحديثات الحساب")}</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-semibold text-[var(--color-ink-950)]">{t("Notifications", "الإشعارات")}</h1><p className="text-sm text-[var(--muted)]">{unreadCount} {t("unread", "غير مقروء")}</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-4 text-sm text-[var(--color-ink-800)]">{notice}</p>}
      <section aria-labelledby="notification-preferences-heading" className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="notification-preferences-heading" className="text-lg font-semibold text-[var(--color-ink-950)]">{t("Notification preferences", "تفضيلات الإشعارات")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{t("Choose in-app and email channels for each event. Email is sent only after you enable it and record consent.", "اختر قنوات الإشعارات داخل التطبيق والبريد الإلكتروني لكل حدث. لن يُرسل البريد إلا بعد تفعيله وتسجيل موافقتك.")}</p></div><button type="button" onClick={() => void savePreferences()} disabled={loading || savingPreferences || preferences.length === 0} className="rounded-xl bg-[var(--color-ink-600)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingPreferences ? t("Saving…", "جارٍ الحفظ…") : t("Save preferences", "حفظ التفضيلات")}</button></div>
        <div className="mt-5 divide-y divide-[var(--border)]">{preferences.map((preference) => <div key={preference.type} className="flex flex-wrap items-center justify-between gap-4 py-4"><span className="min-w-0 w-full flex-1 sm:min-w-[12rem]"><span className="block text-sm font-semibold">{preference.label}</span><span className="mt-1 block text-xs text-[var(--muted)]">{preference.description}</span></span><div className="flex items-center gap-5"><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={preference.inAppEnabled} onChange={(event) => setPreferences((current) => current.map((item) => item.type === preference.type ? { ...item, inAppEnabled: event.target.checked } : item))} className="h-4 w-4 accent-[var(--color-ink-600)]" />{t("In-app", "داخل التطبيق")}</label><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={preference.emailEnabled} onChange={(event) => setPreferences((current) => current.map((item) => item.type === preference.type ? { ...item, emailEnabled: event.target.checked } : item))} className="h-4 w-4 accent-[var(--color-ink-600)]" />{t("Email", "البريد الإلكتروني")}</label></div></div>)}</div>
      </section>
      <section aria-labelledby="email-delivery-heading" className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 id="email-delivery-heading" className="text-lg font-semibold text-[var(--color-ink-950)]">{t("Email delivery history", "سجل إرسال البريد الإلكتروني")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{t("Delivery status for your recent email notifications.", "حالة إرسال إشعارات البريد الإلكتروني الأخيرة.")}</p>{emailDeliveries.length ? <div className="mt-4 divide-y divide-[var(--border)]">{emailDeliveries.slice(0,10).map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><span className="block text-sm font-medium">{delivery.title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{new Date(delivery.createdAt).toLocaleString()} · {delivery.attempts} {t("attempt(s)", "محاولة")}</span></span><span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-600)]"><StatusBadge locale={locale} status={delivery.status} />{delivery.sentAt ? ` · ${new Date(delivery.sentAt).toLocaleString()}` : ""}</span></div>)}</div> : <p className="mt-4 text-sm text-[var(--muted)]">{t("No email deliveries yet. Enable email for an event above to receive future updates.", "لا توجد رسائل بريد إلكتروني بعد. فعّل البريد لحدث أعلاه لتلقي التحديثات القادمة.")}</p>}</section>
      <section aria-labelledby="notification-history-heading" className="mt-10"><h2 id="notification-history-heading" className="text-xl font-semibold text-[var(--color-ink-950)]">{t("Recent activity", "النشاط الأخير")}</h2>
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div className="mt-5 space-y-3">{items.map((item) => <article key={item.id} className={`rounded-2xl border bg-[var(--surface)] p-5 ${item.readAt ? "border-[var(--border)]" : "border-[var(--color-lavender-600)]"}`}><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-semibold">{item.title}</h3>{!item.readAt && <span className="h-2 w-2 rounded-full bg-[var(--color-lavender-600)]" />}</div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.message}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>{item.deliveries?.[0] && <p className="mt-2 text-xs text-[var(--muted)]">{t("Email delivery:", "إرسال البريد الإلكتروني:")} {item.deliveries[0].status.toLowerCase().replaceAll("_"," ")} · {item.deliveries[0].attempts} {t("attempt(s)", "محاولة")}{item.deliveries[0].sentAt ? ` · ${t("sent", "أُرسل")} ${new Date(item.deliveries[0].sentAt).toLocaleString()}` : ""}</p>}</div><div className="flex items-center gap-3"><Link href={href(item)} className="text-sm font-semibold text-[var(--color-ink-600)]">{t("Open", "فتح")}</Link>{!item.readAt && <button disabled={busyId === item.id} onClick={() => void markRead(item.id)} className="text-xs font-semibold text-[var(--muted)] disabled:opacity-50">{busyId === item.id ? t("Saving…", "جارٍ الحفظ…") : t("Mark read", "تحديد كمقروء")}</button>}</div></div></article>)}</div> : !error ? <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{t("You have no notifications yet.", "ليس لديك إشعارات بعد.")}</div> : null}
      </section>
    </div>
  </main>;
}
