"use client";

import { useState } from "react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  slug: string;
  storeName: string;
  description: string | null;
  imageUrl: string | null;
  prices: Array<{ amount: string; currencyCode: string }>;
};
type Order = {
  orderNumber: string;
  status: string;
  placedAt: string;
  total: string;
  currencyCode: string;
  shipments: Array<{ store: string; status: string; carrier: string | null; trackingUrl: string | null }>;
};
type Message = { role: "user" | "assistant"; content: string; products?: Product[]; orders?: Order[] };

const suggestions = [
  "ابحث عن منتجات إلكترونية",
  "ما المنتجات المتوفرة في المتجر؟",
  "كيف أتواصل مع خدمة العملاء؟"
];

export default function MatjarAIAssistant() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(text = message) {
    const value = text.trim();
    if (!value || busy) return;
    const next = [...messages, { role: "user" as const, content: value }];
    setMessages(next);
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: value,
          locale: /[\u0600-\u06FF]/.test(value) ? "ar" : "en",
          history: messages.slice(-6).map(({ role, content }) => ({ role, content }))
        })
      });
      const data = await response.json() as { message?: string; products?: Product[]; orders?: Order[]; error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر الاتصال بالمساعد.");
      setMessages([...next, { role: "assistant", content: data.message || "", products: data.products || [], orders: data.orders || [] }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر الاتصال بالمساعد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && (
        <section dir="rtl" aria-label="Matjar AI assistant" className="mb-3 flex h-[min(650px,calc(100dvh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[var(--surface)] shadow-[0_24px_80px_rgba(48,45,59,0.24)]">
          <header className="flex items-center justify-between bg-[var(--color-lavender-800)] px-5 py-4 text-white">
            <div>
              <p className="font-bold">Matjar AI</p>
              <p className="text-xs text-white/75">مساعد التسوق وخدمة العملاء</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-full px-3 py-1 text-xl hover:bg-white/15">×</button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-[var(--color-ink-800)] shadow-sm">
                  مرحباً بك في Matjar! اسألني عن المنتجات أو الأسعار أو كيفية استخدام المتجر. تُرسل رسائلك إلى Groq لتوليد الإجابة، أما تفاصيل طلباتك فتُعرض من Matjar مباشرة ولا تُرسل إلى النموذج. لا ترسل كلمات المرور أو بيانات الدفع.
                </div>
                <Link href="/account/support" className="block text-center text-xs font-semibold text-[var(--color-lavender-800)] underline">التواصل مع خدمة العملاء</Link>
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-right text-xs text-[var(--color-lavender-800)] hover:bg-[var(--color-lavender-50)]">
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {messages.map((item, index) => (
              <div key={index} className={item.role === "user" ? "mr-8 rounded-2xl rounded-bl-sm bg-[var(--color-lavender-800)] p-3 text-sm leading-6 text-white" : "ml-5 rounded-2xl rounded-br-sm bg-white p-3 text-sm leading-7 text-[var(--color-ink-800)] shadow-sm"}>
                <p dir="auto" className="whitespace-pre-wrap">{item.content}</p>
                {item.orders?.map((order) => (
                  <div key={order.orderNumber} className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--color-mint-50)] p-3 text-xs text-[var(--color-ink-800)]">
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>{order.orderNumber}</span><span>{order.status}</span>
                    </div>
                    <p className="mt-1">{order.total} {order.currencyCode} · {new Date(order.placedAt).toLocaleDateString()}</p>
                    {order.shipments.map((shipment, shipmentIndex) => (
                      <div key={shipmentIndex} className="mt-2 border-t border-[var(--border)] pt-2">
                        <p>{shipment.store}: {shipment.status}</p>
                        {shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="font-semibold underline">تتبع الشحنة</a>}
                      </div>
                    ))}
                  </div>
                ))}
                {item.products?.map((product) => (
                  <a key={product.id} href={`/products/${encodeURIComponent(product.slug)}`} className="mt-3 flex gap-3 rounded-xl border border-[var(--border)] p-2 text-[var(--color-ink-800)] hover:bg-[var(--color-lavender-50)]">
                    {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-[var(--color-lavender-100)]" />}
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-2 text-xs font-bold">{product.name}</span>
                      <span className="mt-1 block text-[10px] text-[var(--muted)]">{product.storeName}</span>
                      {product.prices.map((price) => <span key={price.currencyCode} className="mr-2 text-xs font-bold">{price.amount} {price.currencyCode}</span>)}
                    </span>
                  </a>
                ))}
              </div>
            ))}
            {busy && <p className="text-xs text-[var(--muted)]">يفكر المساعد...</p>}
            {error && <p role="alert" className="rounded-xl bg-[var(--color-blush-50)] p-3 text-xs text-[var(--color-danger)]">{error}</p>}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex gap-2 border-t border-[var(--border)] bg-white/70 p-3">
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} placeholder="اكتب سؤالك..." aria-label="Your message" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-lavender-600)]" />
            <button type="submit" disabled={busy || !message.trim()} className="rounded-xl bg-[var(--color-lavender-800)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">إرسال</button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-14 items-center gap-2 rounded-full border border-white/80 bg-[var(--color-lavender-800)] px-5 font-bold text-white shadow-[var(--shadow-floating)] hover:-translate-y-0.5">
        <span aria-hidden="true">✦</span> اسأل Matjar AI
      </button>
    </div>
  );
}
