import { NextResponse } from "next/server";
import { listHolidays } from "@/lib/graph";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;
    const items = await listHolidays(from, to);
    return NextResponse.json({ ok: true, holidays: items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load holidays" }, { status: 500 });
  }
}

