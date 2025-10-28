import { NextResponse } from "next/server";
import { getWeeklyOffConfig, setWeeklyOffConfig } from "@/lib/graph";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const employeeNo = url.searchParams.get("employeeNo");
    const email = url.searchParams.get("email");
    const username = url.searchParams.get("username");
    const id = employeeNo || username || email;
    if (!id) return NextResponse.json({ ok: false, error: "Missing employeeNo or username" }, { status: 400 });
    const cfg = await getWeeklyOffConfig(id);
    return NextResponse.json({ ok: true, config: cfg });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load weekly config" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.employeeNo || body?.username || body?.email || "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing employeeNo or username" }, { status: 400 });
    const days = {
      mon: !!body?.mon,
      tue: !!body?.tue,
      wed: !!body?.wed,
      thu: !!body?.thu,
      fri: !!body?.fri,
      sat: !!body?.sat,
      sun: !!body?.sun,
    };
    await setWeeklyOffConfig(id, days, body?.effectiveFrom);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to save weekly config" }, { status: 500 });
  }
}
