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

    let checkoutLat: number | undefined;
    let checkoutLon: number | undefined;
    if (enriched.checkoutGps && typeof enriched.checkoutGps === "string") {
      const parts = enriched.checkoutGps.split(',').map((s: string) => s.trim());
      if (parts.length === 2) {
        const lat = Number(parts[0]);
        const lon = Number(parts[1]);
        if (isFinite(lat) && isFinite(lon)) { checkoutLat = lat; checkoutLon = lon; }
      }
    }

    const rowObj: Record<string, any> = {
      checkoutISO: enriched.checkout ? new Date(enriched.checkout).toISOString() : "",
      locationName: enriched.locationName ?? "",
      checkoutGps: enriched.checkoutGps ?? "",
      checkoutAddress: enriched.checkoutAddress ?? "",
      checkoutPhotoUrl: enriched.checkoutPhotoUrl ?? "",
      email: enriched.email ?? "",
      name: enriched.name ?? "",
      employeeNo: enriched.employeeNo ?? "",
      supervisorEmail: enriched.supervisorEmail ?? "",
      province: enriched.province ?? "",
      channel: enriched.channel ?? "",
      district: enriched.district ?? "",
      checkoutLat,
      checkoutLon,
    };

    await addRowToTableByObject(graphTables.checkout(), rowObj);

    // Compute current status by checking if a matching check-in exists
    let status: "incomplete" | "completed" = "incomplete";
    try {
      const ciTbl = graphTables.checkin();
      const [headers, rows] = await Promise.all([getTableHeaders(ciTbl), getTableValues(ciTbl)]);
      const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      const id = { iso: idx("checkinISO"), email: idx("email"), location: idx("locationName") };
      const targetDate = enriched.checkout ? new Date(enriched.checkout).toISOString().slice(0, 10) : "";
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
    return NextResponse.json({ ok: false, error: e?.message || "Checkout failed" }, { status: 500 });
  }
}
