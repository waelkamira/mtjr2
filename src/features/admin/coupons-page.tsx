"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { toast } from "sonner";

type Coupon = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: string;
  currencyCode: string | null;
  currency: { code: string } | null;
  isActive: boolean;
  maxRedemptions: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  _count: { redemptions: number };
};

export default function AdminCouponsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<Coupon["discountType"]>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/admin/coupons", { cache: "no-store" });
        const data = await response.json() as { items?: Coupon[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Coupon list unavailable.");
        if (active) { setItems(data.items || []); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Coupon list unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, revision]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discountType,
          value,
          ...(discountType === "FIXED_AMOUNT" ? { currencyCode } : {}),
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Coupon creation failed.");
      setCode(""); setValue(""); setCurrencyCode(""); setMaxRedemptions(""); setStartsAt(""); setExpiresAt("");
      setMessage(translate(locale, "Global coupon created and audited.", "تم إنشاء رمز الخصم العام وتسجيله في سجل التدقيق."));
      toast.success(translate(locale, "Coupon created.", "تم إنشاء رمز الخصم."));
      setRevision((current) => current + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Coupon creation failed.", "تعذر إنشاء رمز الخصم.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function setActive(coupon: Coupon) {
    setBusy(coupon.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Coupon update failed.");
      setMessage(`${translate(locale, "Coupon", "رمز الخصم")} ${coupon.code} ${coupon.isActive ? translate(locale, "deactivated", "تم تعطيله") : translate(locale, "activated", "تم تفعيله")}.`);
      toast.success(coupon.isActive ? translate(locale, "Coupon deactivated.", "تم تعطيل رمز الخصم.") : translate(locale, "Coupon activated.", "تم تفعيل رمز الخصم."));
      setRevision((current) => current + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Coupon update failed.", "تعذر تحديث رمز الخصم.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  return <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Marketing operations", "عمليات التسويق")}</p>
    <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Global discount codes", "رموز الخصم العامة")}</h1>
    <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Coupons currently apply platform-wide. The current model does not record whether the platform or a seller funds a discount, so funding allocation and per-store restrictions are not represented.", "تُطبّق القسائم حاليًا على المنصة بأكملها. لا يسجل النموذج الحالي ما إذا كانت المنصة أو البائع يمول الخصم، لذلك لا يتم تمثيل توزيع التمويل أو القيود لكل متجر.")}</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <form onSubmit={(event) => void create(event)} className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Coupon code", "رمز القسيمة")}<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm uppercase text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Discount type", "نوع الخصم")}<select value={discountType} onChange={(event) => setDiscountType(event.target.value as Coupon["discountType"])} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="PERCENTAGE">{translate(locale, "Percentage", "نسبة مئوية")}</option><option value="FIXED_AMOUNT">{translate(locale, "Fixed amount", "مبلغ ثابت")}</option></select></label>
      <label className="text-xs font-medium text-[var(--muted)]">{discountType === "PERCENTAGE" ? translate(locale, "Value (basis points; 1000 = 10%)", "القيمة (نقاط الأساس؛ 1000 = 10٪)") : translate(locale, "Amount (minor currency units)", "المبلغ (بوحدات العملة الفرعية)")}<input required inputMode="numeric" pattern="[1-9][0-9]{0,15}" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      {discountType === "FIXED_AMOUNT" && <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Currency code", "رمز العملة")}<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm uppercase text-[var(--foreground)]" /></label>}
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Maximum redemptions (optional)", "الحد الأقصى للاستخدام (اختياري)")}<input type="number" min={1} max={10000000} value={maxRedemptions} onChange={(event) => setMaxRedemptions(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Starts at (optional)", "تاريخ البدء (اختياري)")}<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Expires at (optional)", "تاريخ الانتهاء (اختياري)")}<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
      <div className="flex items-end md:col-span-2 xl:col-span-3"><button disabled={busy !== ""} className="rounded-xl bg-[var(--color-forest-900)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "create" ? translate(locale, "Creating…", "جارٍ الإنشاء…") : translate(locale, "Create global coupon", "إنشاء قسيمة عامة")}</button></div>
    </form>
    <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5">
      <h2 className="text-lg font-semibold">{translate(locale, "Existing coupons", "القسائم الحالية")}</h2>
      {loading ? <div className="mt-4 h-36 animate-pulse rounded-xl bg-[var(--color-ivory-100)]" /> : <div className="mt-4 divide-y divide-[var(--border)]">{items.map((coupon) => <article key={coupon.id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="font-semibold">{coupon.code} <StatusBadge locale={locale} status={coupon.isActive ? "ACTIVE" : "INACTIVE"} className="ml-2" /></p><p className="mt-1 text-sm text-[var(--muted)]">{coupon.discountType === "PERCENTAGE" ? `${Number(coupon.value) / 100}%` : `${coupon.value} ${translate(locale, "minor units", "وحدات فرعية")} ${coupon.currency?.code || coupon.currencyCode}`} · {coupon._count.redemptions} {translate(locale, "redemption(s)", "عملية استخدام")}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}</p><p className="mt-1 text-xs text-[var(--muted)]">{coupon.startsAt ? `${translate(locale, "Starts", "يبدأ")} ${new Date(coupon.startsAt).toLocaleString()}` : translate(locale, "No start date", "لا يوجد تاريخ بدء")} · {coupon.expiresAt ? `${translate(locale, "Expires", "ينتهي")} ${new Date(coupon.expiresAt).toLocaleString()}` : translate(locale, "No expiry", "بلا تاريخ انتهاء")}</p></div><button disabled={busy === coupon.id} onClick={() => void setActive(coupon)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">{busy === coupon.id ? translate(locale, "Saving…", "جارٍ الحفظ…") : coupon.isActive ? translate(locale, "Deactivate", "إلغاء التفعيل") : translate(locale, "Activate", "تفعيل")}</button></article>)}{!items.length && <p className="py-6 text-center text-sm text-[var(--muted)]">{translate(locale, "No coupons exist yet.", "لا توجد قسائم بعد.")}</p>}</div>}
    </section>
  </div></main>;
}
