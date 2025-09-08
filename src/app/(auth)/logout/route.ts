import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const c of ["session", "role", "name", "email"]) {
    res.cookies.set(c, "", { path: "/", maxAge: 0 });
  }
  return res;
}
