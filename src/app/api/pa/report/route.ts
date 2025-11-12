import { NextResponse } from "next/server";
import { listActivities, findUserByEmail } from "@/lib/graph";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, location, district, group } = raw || {};
    const c = cookies();
    const role = (await c).get("role")?.value;
    const cookieIdentity = (await c).get("username")?.value || (await c).get("email")?.value;
    const email = role === "SUPERVISOR" ? (raw?.email || raw?.username || undefined) : (cookieIdentity || undefined);
    let rows = await listActivities({
      from,
      to,
      name,
      email,
      district: role === "SUPERVISOR" ? (district || undefined) : undefined,
      group: role === "SUPERVISOR" ? (group || undefined) : undefined,
      location: role === "SUPERVISOR" ? (location || undefined) : (location || undefined),
    });
    // Attach group from Users table when missing; and filter by group if requested
    try {
      const cache = new Map<string, string | undefined>();
      for (const r of rows) {
        const e = String((r as any).email || '').toLowerCase();
        if (!e) continue;
        if (!cache.has(e)) {
          const u = await findUserByEmail(e);
          cache.set(e, (u as any)?.group as string | undefined);
        }
        if ((r as any).group == null) (r as any).group = cache.get(e) || '';
      }
      if (role === "SUPERVISOR" && group) {
        const g = String(group).toLowerCase();
        rows = rows.filter((r: any) => String(r.group || '').toLowerCase().includes(g));
      }
    } catch {}
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load report" }, { status: 500 });
  }
}
