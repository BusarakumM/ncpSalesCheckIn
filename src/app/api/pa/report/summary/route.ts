import { NextResponse } from "next/server";
import { listActivities } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, district } = raw || {};
    const rows = await listActivities({ from, to, district });

    const summaryMap = new Map<string, { name: string; district?: string; total: number; completed: number; incomplete: number; ongoing: number }>();
    for (const r of rows) {
      const name = r.name || "Unknown";
      let s = summaryMap.get(name);
      if (!s) {
        s = { name, district: r.district || "", total: 0, completed: 0, incomplete: 0, ongoing: 0 };
        summaryMap.set(name, s);
      }
      s.total += 1;
      if (r.status === "completed") s.completed += 1;
      else if (r.status === "incomplete") s.incomplete += 1;
      else s.ongoing += 1;
      if (!s.district && r.district) s.district = r.district;
    }
    const summary = Array.from(summaryMap.values());
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load summary" }, { status: 500 });
  }
}
