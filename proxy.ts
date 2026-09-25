import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/session-token";

/**
 * Optimistic check: hanya membaca cookie (tanpa query database) demi cepat.
 * Verifikasi aman terhadap `users.is_admin` tetap dilakukan di
 * `verifySession()` pada layout panel dan setiap Server Action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/admin/login") {
    return session
      ? NextResponse.redirect(new URL("/admin", request.url))
      : NextResponse.next();
  }

  if (!session) {
    const target = new URL("/admin/login", request.url);
    target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
