import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addRowToTable, graphTables, listLeaves } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = await req.json();

    const c = cookies();
    const enriched = {
      ...raw,
      email: c.get("email")?.value,
      name: c.get("name")?.value,
      role: c.get("role")?.value,
      employeeNo: c.get("employeeNo")?.value,
      supervisorEmail: c.get("supervisorEmail")?.value,
      province: c.get("province")?.value,
      channel: c.get("channel")?.value,
      district: c.get("district")?.value,
    } as any;

    const row = [
      enriched.dt ? new Date(enriched.dt).toISOString() : "",
      enriched.type ?? "",
      enriched.reason ?? "",
      enriched.email ?? "",
      enriched.name ?? "",
      enriched.employeeNo ?? "",
      enriched.supervisorEmail ?? "",
      enriched.province ?? "",
      enriched.channel ?? "",
      enriched.district ?? "",
    ];

    await addRowToTable(graphTables.leave(), row);
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
    const email = url.searchParams.get("email") || undefined;
    const employeeNo = url.searchParams.get("employeeNo") || undefined;
    const rows = await listLeaves({ from, to, email, employeeNo });
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to list leaves" }, { status: 500 });
  }
}
