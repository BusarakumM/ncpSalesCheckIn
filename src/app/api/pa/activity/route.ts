import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listActivities } from "@/lib/graph";
import { buildServerCacheKey, getOrSetServerCache, serverCacheNamespaces } from "@/lib/serverCache";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, email, username, employeeNo, district, group, status } = raw || {};

    // Derive identity and role from cookies. Non-supervisors are forced to their own identity.
    const c = await cookies();
    const role = c.get("role")?.value;
    const cookieIdentity = c.get("username")?.value || c.get("email")?.value || "";
    const isSupervisor = role === "SUPERVISOR";

    // Supervisors see all by default; they only filter by identity when provided.
    const identity = isSupervisor ? (email || username || "") : cookieIdentity;

    if (!identity && !isSupervisor) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const listArgs = {
      from,
      to,
      name: isSupervisor ? name : undefined,
      email: isSupervisor ? (identity || undefined) : cookieIdentity,
      employeeNo: isSupervisor ? employeeNo : undefined,
      district: isSupervisor ? district : undefined,
      group: isSupervisor ? group : undefined,
      status,
    };

    const cacheKey = buildServerCacheKey(serverCacheNamespaces.activity, {
      role: isSupervisor ? "SUPERVISOR" : "AGENT",
      identity: isSupervisor ? (identity || "") : cookieIdentity,
      filters: {
        from: from || "",
        to: to || "",
        name: isSupervisor ? name || "" : "",
        employeeNo: isSupervisor ? employeeNo || "" : "",
        district: isSupervisor ? district || "" : "",
        group: isSupervisor ? group || "" : "",
        status: status || "",
      },
    });

    const payload = await getOrSetServerCache(cacheKey, 30_000, async () => ({
      ok: true as const,
      rows: await listActivities(listArgs),
    }));

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load activities" }, { status: 500 });
  }
}
