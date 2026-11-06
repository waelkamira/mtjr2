"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function changeLanguage() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await setLocale(locale === "ar" ? "en" : "ar");
    } catch {
      setError(translate(locale, "Unable to save your language preference.", "تعذّر حفظ تفضيل اللغة."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => void changeLanguage()}
        disabled={busy}
        aria-label={translate(locale, "Switch language", "تغيير اللغة")}
        className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--color-onyx)] shadow-[var(--shadow-clay)] transition hover:shadow-[var(--shadow-clay-hover)] disabled:cursor-wait disabled:opacity-60 ${compact ? "w-full text-start" : ""}`}
      >
        {busy
          ? translate(locale, "Changing…", "جارٍ التغيير…")
          : locale === "ar" ? "English" : "العربية"}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{error}</span>}
    </span>
  );
}
