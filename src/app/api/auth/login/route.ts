import { NextResponse } from "next/server";
import { resolveUserRole } from "@/lib/roleResolver";

type Body = { user?: string; email?: string; password?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const resolution = await resolveUserRole({
    email: body.email || body.user,
    user: body.user,
    password: body.password,
  });

  const res = NextResponse.json({
    ok: true,
    role: resolution.role,
    name: resolution.name,
    email: resolution.email,
    metadata: resolution.metadata,
    resolution: resolution.resolution,
  });

  res.cookies.set("session", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });

  res.cookies.set("role", resolution.role, { path: "/", sameSite: "lax" });
  res.cookies.set("name", resolution.name, { path: "/", sameSite: "lax" });

  if (resolution.email) {
    res.cookies.set("email", resolution.email, { path: "/", sameSite: "lax" });
  }

  const { employeeNo, supervisorEmail, province, channel } = resolution.metadata;
  if (employeeNo) res.cookies.set("employeeNo", employeeNo, { path: "/", sameSite: "lax" });
  if (supervisorEmail) res.cookies.set("supervisorEmail", supervisorEmail, { path: "/", sameSite: "lax" });
  if (province) res.cookies.set("province", province, { path: "/", sameSite: "lax" });
  if (channel) res.cookies.set("channel", channel, { path: "/", sameSite: "lax" });
  if (resolution.metadata?.district) res.cookies.set("district", resolution.metadata.district, { path: "/", sameSite: "lax" });

  return res;
}
