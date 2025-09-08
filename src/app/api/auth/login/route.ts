import { NextResponse } from "next/server";

type Body = { user?: string; email?: string; password?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  // For now, accept any credentials and pick role by heuristic
  const name = body.user?.trim() || "Supervisor";
  const email = (body.email || "").toLowerCase();

  // Decide role – customize this however you like
  const isSupervisor =
    name.toLowerCase().includes("supervisor") ||
    email === "supervisor@ncp.co.th";

  const res = NextResponse.json({ ok: true, role: isSupervisor ? "SUPERVISOR" : "AGENT" });

  // Basic demo cookies
  res.cookies.set("session", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  res.cookies.set("role", isSupervisor ? "SUPERVISOR" : "AGENT", { path: "/", sameSite: "lax" });
  res.cookies.set("name", name, { path: "/", sameSite: "lax" });
  if (email) res.cookies.set("email", email, { path: "/", sameSite: "lax" });

  return res;
}
