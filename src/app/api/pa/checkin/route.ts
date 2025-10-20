import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addRowToTableByObject, graphTables } from "@/lib/graph";

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
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Check-in failed" }, { status: 500 });
  }
}
