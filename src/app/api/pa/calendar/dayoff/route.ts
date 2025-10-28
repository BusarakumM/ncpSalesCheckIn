import { NextResponse } from "next/server";
import { addDayOff, listDayOffs } from "@/lib/graph";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;
    const email = url.searchParams.get("email") || undefined;
    const employeeNo = url.searchParams.get("employeeNo") || undefined;
    const items = await listDayOffs({ from, to, email, employeeNo });
    return NextResponse.json({ ok: true, dayoffs: items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load day-offs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const by = (await cookies()).get("username")?.value || (await cookies()).get("email")?.value || (await cookies()).get("name")?.value || "";
    if (!(body?.employeeNo || body?.email || body?.username) || !body?.dateISO || !body?.leaveType) {
      return NextResponse.json({ ok: false, error: "Missing employeeNo/username or dateISO/leaveType" }, { status: 400 });
    }
    await addDayOff({ employeeNo: body.employeeNo, email: body.email, username: body.username, dateISO: body.dateISO, leaveType: body.leaveType, remark: body.remark, by });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to add day-off" }, { status: 500 });
  }
}
