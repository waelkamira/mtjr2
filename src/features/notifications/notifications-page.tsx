"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string; type: string; title: string; message: string;
  resourceType: string | null; resourceId: string | null; readAt: string | null; createdAt: string; deliveries?: { status: string; attempts: number; sentAt: string | null }[];
};
type NotificationPreference = {
  type: string; label: string; description: string; inAppEnabled: boolean; emailEnabled: boolean;
};
type EmailDeliveryItem = { id: string; type: string; title: string; status: string; attempts: number; sentAt: string | null; createdAt: string };

export default function NotificationsPage() {
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
    if (!notificationResponse.ok) throw new Error(notificationData.error || "Notifications could not be loaded.");
    if (!preferenceResponse.ok) throw new Error(preferenceData.error || "Notification preferences could not be loaded.");
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
        if (!response.ok) throw new Error(data.error || "Notifications could not be loaded.");
        if (active) { setItems(data.items || []); setUnreadCount(data.unreadCount || 0); setEmailDeliveries(data.emailDeliveries || []); }
      }),
      fetch("/api/account/notification-preferences", { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { preferences?: NotificationPreference[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Notification preferences could not be loaded.");
        if (active) setPreferences(data.preferences || []);
      })
    ]).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Notifications could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function markRead(id: string) {
    setBusyId(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Notification could not be updated.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Notification could not be updated."); }
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
      if (!response.ok) throw new Error(data.error || "Notification preferences could not be saved.");
      setPreferences(data.preferences || []);
      setNotice("Your notification preferences have been saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Notification preferences could not be saved."); }
    finally { setSavingPreferences(false); }
  }

  function href(item: NotificationItem) {
    if (item.resourceType === "ORDER" && item.resourceId) return `/orders/${item.resourceId}`;
    if (item.resourceType === "VENDOR_ORDER") return "/seller/orders";
    if (item.resourceType === "store_conversation" && item.resourceId) return `/account/messages/${item.resourceId}`;
    if (item.resourceType === "support_ticket" && item.resourceId) return `/account/support/${item.resourceId}`;
    return "/notifications";
  }

  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-4xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/account/profile" className="text-sm">My account</Link></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Account updates</p><div className="mt-2 flex items-end justify-between gap-3"><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">Notifications</h1><p className="text-sm text-[var(--muted)]">{unreadCount} unread</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-4 text-sm text-[var(--color-forest-900)]">{notice}</p>}
      <section aria-labelledby="notification-preferences-heading" className="mt-7 rounded-3xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="notification-preferences-heading" className="text-lg font-semibold text-[var(--color-forest-950)]">Notification preferences</h2><p className="mt-1 text-sm text-[var(--muted)]">Choose in-app and email channels for each event. Email is sent only after you enable it and record consent.</p></div><button type="button" onClick={() => void savePreferences()} disabled={loading || savingPreferences || preferences.length === 0} className="rounded-xl bg-[var(--color-forest-800)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingPreferences ? "Saving…" : "Save preferences"}</button></div>
        <div className="mt-5 divide-y divide-[var(--border)]">{preferences.map((preference) => <div key={preference.type} className="flex flex-wrap items-center justify-between gap-4 py-4"><span className="min-w-[12rem] flex-1"><span className="block text-sm font-semibold">{preference.label}</span><span className="mt-1 block text-xs text-[var(--muted)]">{preference.description}</span></span><div className="flex items-center gap-5"><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={preference.inAppEnabled} onChange={(event) => setPreferences((current) => current.map((item) => item.type === preference.type ? { ...item, inAppEnabled: event.target.checked } : item))} className="h-4 w-4 accent-[var(--color-forest-800)]" />In-app</label><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={preference.emailEnabled} onChange={(event) => setPreferences((current) => current.map((item) => item.type === preference.type ? { ...item, emailEnabled: event.target.checked } : item))} className="h-4 w-4 accent-[var(--color-forest-800)]" />Email</label></div></div>)}</div>
      </section>
      <section aria-labelledby="email-delivery-heading" className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6"><h2 id="email-delivery-heading" className="text-lg font-semibold text-[var(--color-forest-950)]">Email delivery history</h2><p className="mt-1 text-sm text-[var(--muted)]">Delivery status for your recent email notifications.</p>{emailDeliveries.length ? <div className="mt-4 divide-y divide-[var(--border)]">{emailDeliveries.slice(0,10).map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><span className="block text-sm font-medium">{delivery.title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{new Date(delivery.createdAt).toLocaleString()} · {delivery.attempts} attempt(s)</span></span><span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-forest-800)]">{delivery.status.toLowerCase().replaceAll("_"," ")}{delivery.sentAt ? ` · ${new Date(delivery.sentAt).toLocaleString()}` : ""}</span></div>)}</div> : <p className="mt-4 text-sm text-[var(--muted)]">No email deliveries yet. Enable email for an event above to receive future updates.</p>}</section>
      <section aria-labelledby="notification-history-heading" className="mt-10"><h2 id="notification-history-heading" className="text-xl font-semibold text-[var(--color-forest-950)]">Recent activity</h2>
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-5 space-y-3">{items.map((item) => <article key={item.id} className={`rounded-2xl border bg-white p-5 ${item.readAt ? "border-[var(--border)]" : "border-[var(--color-copper-500)]"}`}><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-semibold">{item.title}</h3>{!item.readAt && <span className="h-2 w-2 rounded-full bg-[var(--color-copper-600)]" />}</div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.message}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>{item.deliveries?.[0] && <p className="mt-2 text-xs text-[var(--muted)]">Email delivery: {item.deliveries[0].status.toLowerCase().replaceAll("_"," ")} · {item.deliveries[0].attempts} attempt(s){item.deliveries[0].sentAt ? ` · sent ${new Date(item.deliveries[0].sentAt).toLocaleString()}` : ""}</p>}</div><div className="flex items-center gap-3"><Link href={href(item)} className="text-sm font-semibold text-[var(--color-forest-800)]">Open</Link>{!item.readAt && <button disabled={busyId === item.id} onClick={() => void markRead(item.id)} className="text-xs font-semibold text-[var(--muted)] disabled:opacity-50">{busyId === item.id ? "Saving…" : "Mark read"}</button>}</div></div></article>)}</div> : !error ? <div className="mt-5 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">You have no notifications yet.</div> : null}
      </section>
    </div>
  </main>;
}
