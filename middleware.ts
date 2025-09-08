import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = [
    "/sign-in",
    "/api/auth/login",
    "/api/auth/logout",
    "/manifest.json",
    "/icons",
    "/offline",
  ];
  const isPublic =
    publicPaths.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  const role = req.cookies.get("role")?.value;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = role === "SUPERVISOR" ? "/supervisor" : "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
