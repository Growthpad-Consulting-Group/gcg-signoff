import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE_NAME } from "@/features/auth/api/session";

const PUBLIC_PATHS = ["/", "/verify"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth") ||
    // Hit by the outbound mail gateway, not a logged-in browser — both protect themselves
    // with their own RENDER_API_SECRET check instead of a session cookie.
    pathname.startsWith("/api/render") ||
    pathname.startsWith("/api/deploy-status") ||
    // Hit directly from a recipient's email client clicking a campaign banner — no session.
    /^\/api\/campaigns\/[^/]+\/click$/.test(pathname) ||
    // Same, but for a tracked link embedded directly in a signature template.
    /^\/api\/templates\/[^/]+\/click$/.test(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/assets") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await getUserForSessionToken(token) : null;

  if (!user) {
    const loginUrl = new URL("/", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
