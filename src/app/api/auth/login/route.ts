import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/graph";

type Body = { user?: string; email?: string; password?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const identity = (body.user || body.email || "").toString().trim();
  const password = (body.password || "").toString().trim();
  if (!identity || !password) {
    return NextResponse.json({ ok: false, error: "Incorrect username or password" }, { status: 401 });
  }

  function successResponse(payload: { role: "SUPERVISOR" | "AGENT"; name: string; email: string; metadata?: Record<string, any> }) {
    const res = NextResponse.json({ ok: true, role: payload.role, name: payload.name, email: payload.email, username: payload.email });
    res.cookies.set("session", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookies.set("role", payload.role, { path: "/", sameSite: "lax" });
    res.cookies.set("name", payload.name, { path: "/", sameSite: "lax" });
    res.cookies.set("email", payload.email, { path: "/", sameSite: "lax" });
    res.cookies.set("username", payload.email, { path: "/", sameSite: "lax" });
    const meta = payload.metadata || {};
    if (meta.employeeNo) res.cookies.set("employeeNo", String(meta.employeeNo), { path: "/", sameSite: "lax" });
    if (meta.supervisorEmail) res.cookies.set("supervisorEmail", String(meta.supervisorEmail), { path: "/", sameSite: "lax" });
    if (meta.province) res.cookies.set("province", String(meta.province), { path: "/", sameSite: "lax" });
    if (meta.channel) res.cookies.set("channel", String(meta.channel), { path: "/", sameSite: "lax" });
    if (meta.district) res.cookies.set("district", String(meta.district), { path: "/", sameSite: "lax" });
    return res;
  }

  // Load Users row once if available (works with either username or email identity)
  let userRow: Awaited<ReturnType<typeof findUserByEmail>> | null = null;
  try { userRow = await findUserByEmail(identity); } catch {}

  const looksLikeEmail = identity.includes("@");
  const isSupervisorIdentity = (userRow?.role || "").toString().trim().toUpperCase() === "SUPERVISOR";
  if (looksLikeEmail || isSupervisorIdentity) {
    // Supervisor: validate against Azure AD (ROPC)
    const tenant = process.env.GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_ROPC_CLIENT_ID || process.env.GRAPH_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    const scope = process.env.AZURE_ROPC_SCOPE || "openid offline_access";
    if (!tenant || !clientId) {
      return NextResponse.json({ ok: false, error: "Supervisor sign-in not configured" }, { status: 500 });
    }
    try {
      const form = new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        username: identity,
        password,
        scope,
      });
      const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: "Incorrect username or password" }, { status: 401 });
      }
      const name = userRow?.name || identity;
      return successResponse({ role: "SUPERVISOR", name, email: identity, metadata: userRow || undefined });
    } catch {
      return NextResponse.json({ ok: false, error: "Incorrect username or password" }, { status: 401 });
    }
  }

  // Agent: require Users.username + Users.employeeNo to match
  if (!userRow) {
    return NextResponse.json({ ok: false, error: "Incorrect username or password" }, { status: 401 });
  }
  const expected = (userRow.employeeNo || "").toString().trim();
  if (!expected || expected !== password) {
    return NextResponse.json({ ok: false, error: "Incorrect username or password" }, { status: 401 });
  }
  const name = userRow.name || identity;
  const meta = {
    employeeNo: userRow.employeeNo,
    supervisorEmail: userRow.supervisorEmail,
    province: userRow.province,
    channel: userRow.channel,
    district: userRow.district,
  } as Record<string, any>;
  return successResponse({ role: "AGENT", name, email: identity, metadata: meta });
}
