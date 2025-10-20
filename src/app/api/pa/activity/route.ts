import { NextResponse } from "next/server";
import { listActivities } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, email, district } = raw || {};
    const rows = await listActivities({ from, to, name, email, district });
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load activities" }, { status: 500 });
  }
}
