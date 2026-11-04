import { Suspense } from "react";
import CheckoutReviewPage from "@/features/checkout/checkout-review-page";

export default function CheckoutRoute() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--background)] p-8" />}>
    <CheckoutReviewPage />
  </Suspense>;
}
