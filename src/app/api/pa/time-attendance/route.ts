import { NextResponse } from "next/server";
import { listActivities, getTableValues, graphTables } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, email, district } = raw || {};

    const activities = await listActivities({ from, to, name, email, district });

    // Leave rows
    const leaveTable = graphTables.leave();
    const leaves = await getTableValues(leaveTable);
    const idx = { dt: 0, type: 1, reason: 2, email: 3, name: 4, district: 9 } as const;

    let leaveRows = leaves.map((r) => {
      const iso = String(r[idx.dt] || "");
      const d = new Date(iso);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        date,
        checkin: "",
        checkout: "",
        imageIn: "",
        imageOut: "",
        status: String(r[idx.type] || ""),
        remark: String(r[idx.reason] || ""),
        name: String(r[idx.name] || ""),
        district: String(r[idx.district] || ""),
      };
    });
    if (district) {
      const dd = String(district).toLowerCase();
      leaveRows = leaveRows.filter((x) => (x.district || "").toLowerCase().includes(dd));
    }

    // Merge and filter by optional name/email
    let rows = [
      ...activities.map((a) => ({
        date: a.date,
        checkin: a.checkin || "",
        checkout: a.checkout || "",
        imageIn: a.imageIn || "",
        imageOut: a.imageOut || "",
        status: a.status === "completed" ? "" : a.status, // keep status only if not normal
        remark: a.status === "ongoing" ? "No check-out" : a.status === "incomplete" ? "Checkout without check-in" : "",
        name: a.name || "",
        district: a.district || "",
        checkinGps: a.checkinGps || "",
        checkoutGps: a.checkoutGps || "",
        distanceKm: a.distanceKm ?? undefined,
      })),
      ...leaveRows,
    ];

    if (name) {
      const n = String(name).toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(n));
    }

    // Sort by date desc then name asc
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.name || '').localeCompare(b.name || '')));

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load time-attendance" }, { status: 500 });
  }
}
