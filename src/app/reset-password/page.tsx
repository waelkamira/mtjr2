import { Suspense } from "react";
import ResetPasswordPage from "./reset-password-page";

export const metadata = { title: "Reset password", referrer: "no-referrer" as const };

export default function ResetPasswordRoute() {
  return <Suspense fallback={<main className="p-10">Loading password reset…</main>}><ResetPasswordPage /></Suspense>;
}
