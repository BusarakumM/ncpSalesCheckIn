import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addLeaveDelete } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const role = c.get("role")?.value;
    if (role !== "SUPERVISOR") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const dt = String(body?.dt || body?.dtISO || "").trim();
    const employeeNo = body?.employeeNo ? String(body.employeeNo) : undefined;
    const email = body?.email ? String(body.email) : undefined;
    const username = body?.username ? String(body.username) : undefined;
    if (!dt) return NextResponse.json({ ok: false, error: "Missing dt" }, { status: 400 });
    await addLeaveDelete({ dtISO: dt, employeeNo, email, username, by: c.get("username")?.value || c.get("email")?.value || "" });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}

