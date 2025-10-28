import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Redirect the browser right after logout
  const url = new URL("/sign-in", req.url);
  const res = NextResponse.redirect(url, { status: 303 }); // 303 works well after POST

  // Clear auth cookies
  for (const c of ["session", "role", "name", "email", "username"]) {
    res.cookies.set(c, "", { path: "/", maxAge: 0 });
  }

  return res;
}
