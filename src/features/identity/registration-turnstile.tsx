"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": (errorCode: string) => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

export default function RegistrationTurnstile({
  siteKey,
  onToken,
  resetVersion
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetVersion: number;
}) {
  const { locale } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [challengeError, setChallengeError] = useState("");

  useEffect(() => () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (resetVersion > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetVersion]);

  function renderWidget() {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "registration",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": (errorCode) => {
        onToken("");
        setChallengeError(errorCode);
      }
    });
  }

  function retryChallenge() {
    setChallengeError("");
    onToken("");
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }

  if (!siteKey) {
    return <p role="alert" className="text-sm text-red-800">{translate(locale, "Registration bot protection is not configured.", "لم يتم إعداد الحماية من الروبوتات للتسجيل.")}</p>;
  }

  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => setLoadError(true)}
      />
      <div ref={containerRef} />
      {loadError && <p role="alert" className="mt-2 text-sm text-red-800">{translate(locale, "Bot protection could not be loaded. Please try again later.", "تعذّر تحميل الحماية من الروبوتات. حاول مجددًا لاحقًا.")}</p>}
      {challengeError && (
        <div role="alert" className="mt-2 text-sm text-red-800">
          <p>
            {translate(
              locale,
              `The bot check failed (${challengeError}). Try again, or use a private window, disable browser extensions or VPN, or switch networks.`,
              `فشل التحقق من الروبوت (${challengeError}). حاول مجددًا، أو استخدم نافذة خاصة، أو عطّل إضافات المتصفح أو VPN، أو بدّل الشبكة.`
            )}
          </p>
          <button type="button" onClick={retryChallenge} className="mt-1 font-semibold underline">
            {translate(locale, "Retry bot check", "إعادة محاولة التحقق")}
          </button>
        </div>
      )}
    </div>
  );
}
