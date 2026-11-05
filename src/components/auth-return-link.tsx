"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { currentReturnPath } from "@/lib/current-return-path";

export default function AuthReturnLink({
  href,
  className,
  children
}: {
  href: "/login" | "/register";
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const destination = new URL(href, window.location.origin);
    const returnTo = currentReturnPath();
    if (returnTo !== "/") destination.searchParams.set("returnTo", returnTo);
    router.push(`${destination.pathname}${destination.search}`);
  }

  return <Link href={href} onClick={navigate} className={className}>{children}</Link>;
}
