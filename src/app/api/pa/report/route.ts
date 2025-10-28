import { NextResponse } from "next/server";
import { listActivities } from "@/lib/graph";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, location, district } = raw || {};
    const c = cookies();
    const role = (await c).get("role")?.value;
    const cookieEmail = (await c).get("email")?.value;
    const email = role === "SUPERVISOR" ? (raw?.email || undefined) : (cookieEmail || undefined);
    const rows = await listActivities({
      from,
      to,
      name,
      email,
      district: role === "SUPERVISOR" ? (district || undefined) : undefined,
      location: role === "SUPERVISOR" ? (location || undefined) : (location || undefined),
    });
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load report" }, { status: 500 });
  }
}
