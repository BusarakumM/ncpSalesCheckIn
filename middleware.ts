import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes & assets
  const publicPaths = [
    "/sign-in",
    "/api/auth/login",
    "/api/auth/logout",
    "/manifest.json",
    "/icons",
    "/offline",
  ];
  

  const isPublic =
    // listed routes
    publicPaths.some((p) => pathname === p || pathname.startsWith(p)) ||
    // Next internals
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    // 🔓 your static asset folders in /public
    pathname.startsWith("/illustrations/") ||
    pathname.startsWith("/brand/") ||
    // any direct image file (defensive)
    /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(pathname);

  if (isPublic) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  const role = req.cookies.get("role")?.value;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // Redirect root to role home
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = role === "SUPERVISOR" ? "/supervisor" : "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Keep this matcher; we now skip assets inside the function.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
