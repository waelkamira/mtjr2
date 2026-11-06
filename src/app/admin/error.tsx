"use client";

import { RouteErrorState } from "@/components/route-states";

export default function AdminError({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteErrorState error={error} retry={retry} />;
}
