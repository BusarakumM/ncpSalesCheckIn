import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addRowToTableByObject, graphTables, getTableHeaders, getTableValues } from "@/lib/graph";

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

    let checkinLat: number | undefined;
    let checkinLon: number | undefined;
    if (enriched.gps && typeof enriched.gps === "string") {
      const parts = enriched.gps.split(',').map((s: string) => s.trim());
      if (parts.length === 2) {
        const lat = Number(parts[0]);
        const lon = Number(parts[1]);
        if (isFinite(lat) && isFinite(lon)) { checkinLat = lat; checkinLon = lon; }
      }
    }

    const rowObj: Record<string, any> = {
      checkinISO: enriched.checkin ? new Date(enriched.checkin).toISOString() : "",
      locationName: enriched.locationName ?? "",
      gps: enriched.gps ?? "",
      checkinAddress: enriched.checkinAddress ?? "",
      jobTitle: enriched.jobTitle ?? "",
      jobDetail: enriched.jobDetail ?? "",
      photoUrl: enriched.photoUrl ?? "",
      email: enriched.email ?? "",
      name: enriched.name ?? "",
      employeeNo: enriched.employeeNo ?? "",
      supervisorEmail: enriched.supervisorEmail ?? "",
      province: enriched.province ?? "",
      channel: enriched.channel ?? "",
      district: enriched.district ?? "",
      checkinLat,
      checkinLon,
    };

    await addRowToTableByObject(graphTables.checkin(), rowObj);

    // Compute current status by checking if a matching checkout exists
    let status: "ongoing" | "completed" = "ongoing";
    try {
      const coTbl = graphTables.checkout();
      const [headers, rows] = await Promise.all([getTableHeaders(coTbl), getTableValues(coTbl)]);
      const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      const id = { iso: idx("checkoutISO"), email: idx("email"), location: idx("locationName") };
      const targetDate = enriched.checkin ? new Date(enriched.checkin).toISOString().slice(0, 10) : "";
      const email = String(enriched.email || "");
      const location = String(enriched.locationName || "");
      if (id.iso >= 0) {
        for (const r of rows) {
          const iso = String(r[id.iso] || "");
          const d = iso ? new Date(iso).toISOString().slice(0, 10) : "";
          const e = id.email >= 0 ? String(r[id.email] || "") : "";
          const loc = id.location >= 0 ? String(r[id.location] || "") : "";
          if (d === targetDate && (!email || e === email) && (!location || loc === location)) {
            status = "completed";
            break;
          }
        }
      }
    } catch {}

    return NextResponse.json({ ok: true, status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Check-in failed" }, { status: 500 });
  }
}
