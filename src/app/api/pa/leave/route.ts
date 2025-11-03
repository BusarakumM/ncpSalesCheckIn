import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addRowToTableByObject, graphTables, listLeaves } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = await req.json();

    const c = cookies();
    const enriched = {
      ...raw,
      username: c.get("username")?.value || c.get("email")?.value,
      email: c.get("email")?.value,
      name: c.get("name")?.value,
      role: c.get("role")?.value,
      employeeNo: c.get("employeeNo")?.value,
      supervisorEmail: c.get("supervisorEmail")?.value,
      province: c.get("province")?.value,
      channel: c.get("channel")?.value,
      district: c.get("district")?.value,
    } as any;
    // Use object-based insert so header names drive mapping; write both username/email
    const rowObj: Record<string, any> = {
      dtISO: enriched.dt ? new Date(enriched.dt).toISOString() : "",
      leaveType: enriched.type ?? "",
      reason: enriched.reason ?? "",
      email: enriched.username ?? enriched.email ?? "",
      username: enriched.username ?? enriched.email ?? "",
      name: enriched.name ?? "",
      employeeNo: enriched.employeeNo ?? "",
      supervisorEmail: enriched.supervisorEmail ?? "",
      province: enriched.province ?? "",
      channel: enriched.channel ?? "",
      district: enriched.district ?? "",
    };
    await addRowToTableByObject(graphTables.leave(), rowObj);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Leave submit failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;
    let email = url.searchParams.get("email") || url.searchParams.get("username") || undefined;
    let employeeNo = url.searchParams.get("employeeNo") || undefined;
    const me = url.searchParams.get("me");
    if (me && (me === "1" || me.toLowerCase() === "true")) {
      const c = cookies();
      email = (await c).get("username")?.value || (await c).get("email")?.value || email;
      employeeNo = (await c).get("employeeNo")?.value || employeeNo;
    }
    const rows = await listLeaves({ from, to, email, employeeNo });
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to list leaves" }, { status: 500 });
  }
}
