import { Suspense } from "react";
import VerifyEmailPage from "./verify-email-page";

export const metadata = { title: "Verify email", referrer: "no-referrer" as const };

export default function VerifyEmailRoute() {
  return <Suspense fallback={<main className="p-10">Loading verification…</main>}><VerifyEmailPage /></Suspense>;
}
