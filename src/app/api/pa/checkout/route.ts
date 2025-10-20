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
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Checkout failed" }, { status: 500 });
  }
}
