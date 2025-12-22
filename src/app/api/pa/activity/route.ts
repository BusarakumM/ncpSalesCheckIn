import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listActivities } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, email, username, employeeNo, district, group, status } = raw || {};

    // Derive identity and role from cookies. Non-supervisors are forced to their own identity.
    const c = await cookies();
    const role = c.get("role")?.value;
    const cookieIdentity = c.get("username")?.value || c.get("email")?.value || "";
    const isSupervisor = role === "SUPERVISOR";

    // Supervisors can override identity; sales support is locked to their own.
    const identity = isSupervisor ? (email || username || cookieIdentity) : cookieIdentity;

    if (!identity && !isSupervisor) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await listActivities({
      from,
      to,
      name: isSupervisor ? name : undefined,
      email: identity,
      employeeNo: isSupervisor ? employeeNo : undefined,
      district: isSupervisor ? district : undefined,
      group: isSupervisor ? group : undefined,
      status,
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load activities" }, { status: 500 });
  }
}
