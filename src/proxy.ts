import { NextResponse, type NextRequest } from "next/server";
import { REQUESTED_PAGE_PATH_HEADER } from "@/lib/requested-page-path-header";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    REQUESTED_PAGE_PATH_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/account", "/account/:path*", "/admin", "/admin/:path*"]
};
