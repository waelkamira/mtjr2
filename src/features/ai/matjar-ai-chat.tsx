"use client";

import { useState, type FormEvent } from "react";

type ProductSuggestion = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  store: string | null;
  prices: Array<{ amount: string; currency: string }>;
};
type ChatMessage = { role: "user" | "assistant"; content: string };

export default function MatjarAiChat() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [products, setProducts] = useState<ProductSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (text.length < 2 || loading) return;

    setMessages((current) => [...current, { role: "user", content: text }]);
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, locale: "ar" }),
        cache: "no-store"
      });
      const payload = await response.json() as {
        answer?: string;
        error?: string;
        products?: ProductSuggestion[];
      };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "تعذر إرسال الرسالة.");
      }
      setMessages((current) => [...current, { role: "assistant", content: payload.answer! }]);
      setProducts(payload.products ?? []);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 end-5 z-[70]" dir="rtl">
      {open ? (
        <section
          aria-label="مساعد متجر الذكي"
          role="dialog"
          aria-modal="false"
          className="mb-3 flex h-[min( min(680px,calc(100dvh-7rem)),620px)] w-[min( calc(100vw-2rem),390px)] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          <header className="flex items-center justify-between bg-[var(--color-ink-800)] px-5 py-4 text-white">
            <div>
              <p className="font-semibold">مساعد Matjar الذكي</p>
              <p className="mt-1 text-xs text-white/70">مساعدك للعثور على المنتجات</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق المحادثة" className="rounded-full px-3 py-2 text-xl hover:bg-white/10">×</button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-[var(--background)] p-4 text-sm leading-7 text-[var(--color-ink-700)]">
                أهلاً بك! اسألني عن المنتجات أو المواصفات أو الأسعار المتاحة في المتجر.
              </div>
            ) : messages.map((item, index) => (
              <div key={index} className={item.role === "user" ? "ms-8 rounded-2xl rounded-tr-sm bg-[var(--color-ink-800)] p-3 text-sm leading-6 text-white" : "me-5 rounded-2xl rounded-tl-sm bg-[var(--background)] p-3 text-sm leading-7 text-[var(--foreground)]"}>
                {item.content}
              </div>
            ))}
            {loading ? <p className="text-sm text-[var(--muted)]" role="status">يفكر المساعد…</p> : null}
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
            {products.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--muted)]">منتجات ذات صلة</p>
                {products.map((product) => (
                  <article key={product.id} className="rounded-2xl border border-[var(--border)] p-3">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{[product.brand, product.store].filter(Boolean).join(" · ")}</p>
                    {product.prices.length > 0 ? (
                      <p className="mt-2 text-sm font-semibold">{product.prices.map((price) => `${price.amount} ${price.currency}`).join(" / ")}</p>
                    ) : <p className="mt-2 text-xs text-[var(--muted)]">السعر غير متاح لهذه العملة أو السوق.</p>}
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <form onSubmit={sendMessage} className="border-t border-[var(--border)] p-3">
            <label htmlFor="matjar-ai-message" className="sr-only">اكتب رسالتك</label>
            <div className="flex items-end gap-2">
              <textarea
                id="matjar-ai-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1200}
                rows={2}
                placeholder="اكتب سؤالك هنا…"
                className="min-h-11 flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-lavender-600)]"
              />
              <button type="submit" disabled={loading || message.trim().length < 2} className="rounded-2xl bg-[var(--color-ink-800)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">إرسال</button>
            </div>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "إغلاق مساعد Matjar" : "فتح مساعد Matjar"}
        className="flex h-14 items-center gap-2 rounded-full bg-[var(--color-ink-800)] px-5 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5"
      >
        <span aria-hidden="true">✦</span>
        <span>اسأل Matjar</span>
      </button>
    </div>
  );
}
