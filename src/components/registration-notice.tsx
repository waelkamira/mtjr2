"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const NOTICE_EVENT = "mtjr:registration-notice";

export default function RegistrationNotice() {
  const { locale } = useLocale();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function showNotice(event: Event) {
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        setNotice(event.detail);
      }
    }

    window.addEventListener(NOTICE_EVENT, showNotice);
    return () => window.removeEventListener(NOTICE_EVENT, showNotice);
  }, []);

  if (!notice) return null;

  return (
    <div role="status" className="mx-auto mt-4 flex max-w-5xl items-start justify-between gap-4 rounded-xl border border-[var(--color-sage-200)] bg-[var(--color-sage-100)] px-4 py-3 text-sm text-[var(--color-forest-900)]">
      <span>{notice}</span>
      <button type="button" onClick={() => setNotice("")} aria-label={translate(locale, "Dismiss registration notice", "إخفاء إشعار التسجيل")} className="font-semibold">×</button>
    </div>
  );
}
