"use client";

import "./globals.css";
import { RouteErrorState } from "@/components/route-states";

export default function GlobalError({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <RouteErrorState error={error} retry={retry} />
      </body>
    </html>
  );
}
