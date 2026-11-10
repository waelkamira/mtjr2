"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { MouseEvent, ReactNode } from "react";
import { currentReturnPath, getCurrentReturnPath } from "@/lib/current-return-path";

type AuthReturnLinkProps = {
  href: "/login" | "/register";
  className?: string;
  children: ReactNode;
};

function navigateToAuth(
  event: MouseEvent<HTMLAnchorElement>,
  href: AuthReturnLinkProps["href"],
  router: ReturnType<typeof useRouter>
) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  const destination = new URL(href, window.location.origin);
  const returnTo = currentReturnPath();
  if (returnTo !== "/") destination.searchParams.set("returnTo", returnTo);
  router.push(`${destination.pathname}${destination.search}`);
}

function AuthReturnLinkFallback({ href, className, children }: AuthReturnLinkProps) {
  const router = useRouter();
  return <Link href={href} onClick={(event) => navigateToAuth(event, href, router)} className={className}>{children}</Link>;
}

function AuthReturnLinkContent({ href, className, children }: AuthReturnLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = getCurrentReturnPath({
    pathname,
    search: searchParams.toString() ? `?${searchParams.toString()}` : "",
    hash: "",
    origin: "https://return-path.invalid"
  });
  const destination = new URL(href, "https://return-path.invalid");
  if (returnTo !== "/") destination.searchParams.set("returnTo", returnTo);

  return <Link href={`${destination.pathname}${destination.search}`} onClick={(event) => navigateToAuth(event, href, router)} className={className}>{children}</Link>;
}

export default function AuthReturnLink(props: AuthReturnLinkProps) {
  return (
    <Suspense fallback={<AuthReturnLinkFallback {...props} />}>
      <AuthReturnLinkContent {...props} />
    </Suspense>
  );
}
