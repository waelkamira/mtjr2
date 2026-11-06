import "server-only";

import { headers } from "next/headers";
import { env } from "@/lib/env";
import { REQUESTED_PAGE_PATH_HEADER } from "@/lib/requested-page-path-header";
import { resolveRequestedPagePath } from "@/lib/requested-page-path";

export async function getRequestedPagePath(
  allowedRoot: "/account" | "/admin",
  fallback: string
): Promise<string> {
  const requestHeaders = await headers();
  return resolveRequestedPagePath(
    requestHeaders.get(REQUESTED_PAGE_PATH_HEADER),
    allowedRoot,
    fallback,
    env.APP_URL
  );
}
