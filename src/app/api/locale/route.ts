import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isLocale, localeCookieName } from "@/lib/locale";

const requestSchema = z.object({
  locale: z.string()
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid language preference." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success || !isLocale(parsed.data.locale)) {
    return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
  }

  const response = NextResponse.json({ locale: parsed.data.locale });
  response.cookies.set(localeCookieName, parsed.data.locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:"
  });
  return response;
}
