"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string; type: string; title: string; message: string;
  resourceType: string | null; resourceId: string | null; readAt: string | null; createdAt: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const data = await response.json() as { items?: NotificationItem[]; unreadCount?: number; error?: string };
    if (!response.ok) throw new Error(data.error || "Notifications could not be loaded.");
    setItems(data.items || []); setUnreadCount(data.unreadCount || 0);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/notifications", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { items?: NotificationItem[]; unreadCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Notifications could not be loaded.");
      if (active) { setItems(data.items || []); setUnreadCount(data.unreadCount || 0); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Notifications could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function markRead(id: string) {
    setBusyId(id); setError("");
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Notification could not be updated.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Notification could not be updated."); }
    finally { setBusyId(""); }
  }
  function href(item: NotificationItem) {
    if (item.resourceType === "ORDER" && item.resourceId) return `/orders/${item.resourceId}`;
    if (item.resourceType === "VENDOR_ORDER") return "/seller/orders";
    return "/notifications";
  }
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-4xl justify-between"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/account/profile" className="text-sm">My account</Link></div></header>
    <div className="mx-auto max-w-4xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Account updates</p><div className="mt-2 flex items-end justify-between gap-3"><h1 className="text-3xl font-semibold text-[var(--color-forest-950)]">Notifications</h1><p className="text-sm text-[var(--muted)]">{unreadCount} unread</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-6 space-y-3">{items.map((item) => <article key={item.id} className={`rounded-2xl border bg-white p-5 ${item.readAt ? "border-[var(--border)]" : "border-[var(--color-copper-500)]"}`}><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="font-semibold">{item.title}</h2>{!item.readAt && <span className="h-2 w-2 rounded-full bg-[var(--color-copper-600)]" />}</div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.message}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-3"><Link href={href(item)} className="text-sm font-semibold text-[var(--color-forest-800)]">Open</Link>{!item.readAt && <button disabled={busyId === item.id} onClick={() => void markRead(item.id)} className="text-xs font-semibold text-[var(--muted)] disabled:opacity-50">{busyId === item.id ? "Saving…" : "Mark read"}</button>}</div></div></article>)}</div> : !error ? <div className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">You have no notifications yet.</div> : null}
    </div>
  </main>;
}
