"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toast } from "sonner";

type Product = {
  id: string; name: string; slug: string; description: string | null; createdAt: string;
  store: { id: string; name: string; seller: { id: string; displayName: string | null; legalName: string | null } };
  media: Array<{ url: string; altText: string | null }>;
  variants: Array<{ id: string; sku: string; name: string | null; prices: Array<{ marketId: string; currencyCode: string; amountMinor: string; currency: { minorUnit: number } }> }>;
};

function formatMinorAmount(amountMinor: string, minorUnit: number) {
  const amount = BigInt(amountMinor);
  const divisor = 10n ** BigInt(minorUnit);
  const whole = (amount / divisor).toString();
  if (minorUnit === 0) return whole;
  const fraction = (amount % divisor).toString().padStart(minorUnit, "0");
  return `${whole}.${fraction}`;
}

export default function AdminProductsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/admin/products", { cache: "no-store" });
        const data = await response.json() as { items?: Product[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Product approval queue unavailable.");
        if (active) { setItems(data.items || []); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Product approval queue unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [revision]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((product) => [
      product.id, product.name, product.slug, product.store.name,
      product.store.seller.displayName || "", product.store.seller.legalName || "",
      ...product.variants.map((variant) => variant.sku)
    ].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [items, query]);

  async function moderate(product: Product, decision: "approve" | "reject") {
    const reason = reasons[product.id]?.trim() || "";
    if (decision === "reject" && reason.length < 5) { setError(t("Enter a rejection reason of at least five characters.", "أدخل سببًا للرفض لا يقل عن خمسة أحرف.")); return; }
    if (!window.confirm(`${decision === "approve" ? t("Approve", "موافقة") : t("Reject", "رفض")} “${product.name}”?`)) return;
    setBusy(product.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(decision === "reject" ? { body: JSON.stringify({ reason }) } : {})
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Product moderation failed.");
      setMessage(decision === "approve" ? t("Product approved. Approval alone does not publish it; the store owner must publish after meeting catalog requirements.", "تمت الموافقة على المنتج. الموافقة وحدها لا تنشره؛ يجب على مالك المتجر نشره بعد استيفاء متطلبات الكتالوج.") : t("Product rejected.", "تم رفض المنتج."));
      toast.success(decision === "approve" ? t("Product approved.", "تمت الموافقة على المنتج.") : t("Product rejected.", "تم رفض المنتج."));
      setReasons((current) => ({ ...current, [product.id]: "" }));
      setRevision((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Product moderation failed.", "تعذرت مراجعة المنتج.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return <main aria-busy={loading || Boolean(busy)} className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{t("Catalog operations", "إدارة الكتالوج")}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-6"><div><h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{t("Product approvals", "اعتماد المنتجات")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{t("Review draft products submitted by active stores. Approval does not publish a product.", "راجع مسودات المنتجات المقدمة من المتاجر النشطة. الموافقة لا تنشر المنتج تلقائياً.")}</p></div><div className="flex items-center gap-2"><p className="text-sm text-[var(--muted)]">{items.length} {t("pending", "معلق")} · {visible.length} {t("shown", "معروض")}</p><button type="button" disabled={loading || Boolean(busy)} onClick={() => { setLoading(true); setError(""); setRevision((value) => value + 1); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50">{t("Refresh", "تحديث")}</button></div></div>
    <form onSubmit={search} className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"><label className="block text-xs font-medium text-[var(--muted)]">{t("Search pending products, stores, sellers or SKU", "ابحث في المنتجات والمتاجر والبائعين أو رمز المنتج")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label></form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" /> : <div aria-busy={loading || Boolean(busy)} className="mt-5 space-y-4">{visible.map((product) => <article key={product.id} className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm md:grid-cols-[160px_1fr]">
      {product.media[0] ? <img src={product.media[0].url} alt={product.media[0].altText || product.name} referrerPolicy="no-referrer" className="h-40 w-full rounded-xl object-cover md:w-40" /> : <div className="flex h-40 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-sm text-[var(--muted)] md:w-40">{t("No primary image", "لا توجد صورة رئيسية")}</div>}
      <div><div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-semibold">{product.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{product.store.name} · {t("Seller", "البائع")} {product.store.seller.displayName || product.store.seller.legalName || product.store.seller.id}</p></div><span className="h-fit rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs">{t("Submitted", "تاريخ التقديم")} {new Date(product.createdAt).toLocaleDateString(locale === "ar" ? "ar-SY" : "en-GB")}</span></div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{product.description || t("No description provided.", "لم يتم تقديم وصف.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">{product.variants.map((variant) => <div key={variant.id} className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs"><span className="font-semibold">{variant.sku}</span>{variant.name && ` · ${variant.name}`}<span className="block text-[var(--muted)]">{variant.prices.map((price) => `${formatMinorAmount(price.amountMinor, price.currency.minorUnit)} ${price.currencyCode}`).join(" · ") || t("No price configured", "لم يتم تحديد سعر")}</span></div>)}</div>
        <label className="mt-4 block text-xs font-medium text-[var(--muted)]">{t("Moderation reason (required for rejection)", "سبب الإشراف (مطلوب عند الرفض)")}<input disabled={Boolean(busy)} value={reasons[product.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [product.id]: event.target.value }))} maxLength={2000} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[#FF8C1C] focus:ring-2 focus:ring-orange-100" /></label>
        <div className="mt-4 flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void moderate(product, "approve")} className="rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-500/20 transition hover:bg-[#F57C00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{t("Approve", "موافقة")}</button><button type="button" disabled={Boolean(busy)} onClick={() => void moderate(product, "reject")} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">{t("Reject", "رفض")}</button></div>
      </div>
    </article>)}{!visible.length && !error && <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{items.length ? t("No pending products match this search.", "لا توجد منتجات معلقة تطابق البحث.") : t("No products are awaiting approval.", "لا توجد منتجات بانتظار الموافقة.")}</div>}</div>}
  </div></main>;
}
