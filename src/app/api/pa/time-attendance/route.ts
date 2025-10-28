import { NextResponse } from "next/server";
import { listActivities, listLeaves } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, email, username, district } = raw || {};

    const identity = email || username;
    const activities = await listActivities({ from, to, name, email: identity, district });

    // Leave rows (use header-based reader to avoid column index drift)
    const leaveItems = await listLeaves({ from, to });
    let leaveRows = leaveItems.map((r) => {
      const d = new Date(r.date || "");
      const date = isNaN(d.getTime())
        ? ""
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        date,
        checkin: "",
        checkout: "",
        imageIn: "",
        imageOut: "",
        status: String(r.leaveType || ""),
        remark: String(r.reason || ""),
        name: String(r.name || ""),
        district: String(r.district || ""),
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
        checkinAddress: a.checkinAddress || "",
        checkoutAddress: a.checkoutAddress || "",
        distanceKm: a.distanceKm ?? undefined,
      })),
      ...leaveRows,
    ];

    if (name) {
      const n = String(name).toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(n));
    }

    // Sort by name asc then date asc
    rows.sort((a, b) => {
      const na = (a.name || "").toLowerCase();
      const nb = (b.name || "").toLowerCase();
      const byName = na.localeCompare(nb);
      if (byName !== 0) return byName;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load time-attendance" }, { status: 500 });
  }
}
