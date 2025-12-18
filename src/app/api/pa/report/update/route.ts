import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { graphTables, updateTableRowByIndex } from "@/lib/graph";

type UpdateBody = {
  id?: string;
  date?: string;
  checkin?: string;
  checkout?: string;
  detail?: string;
  problemDetail?: string;
  remark?: string;
  checkinRowIndex?: number;
  checkoutRowIndex?: number;
};

function buildIso(date?: string, time?: string | null): string | null {
  if (!date || !time) return null;
  const t = String(time).trim();
  if (!t) return null;
  const d = new Date(`${date}T${t}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid time format");
  }
  return d.toISOString();
}

export async function PATCH(req: Request) {
  try {
    const c = cookies();
    const role = (await c).get("role")?.value;
    if (role !== "SUPERVISOR") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdateBody;
    const { id, date, checkin, checkout, detail, problemDetail, remark, checkinRowIndex, checkoutRowIndex } = body;
    if (!id) return NextResponse.json({ ok: false, error: "Missing row id" }, { status: 400 });
    if (!date) return NextResponse.json({ ok: false, error: "Missing date" }, { status: 400 });

    const updateTargets: Array<"checkin" | "checkout"> = [];

    // Check-in updates
    if (checkin != null || detail != null) {
      if (checkinRowIndex == null || checkinRowIndex < 0) {
        return NextResponse.json({ ok: false, error: "Missing check-in row index" }, { status: 400 });
      }
      const payload: Record<string, any> = {};
      if (checkin !== undefined) {
        const iso = buildIso(date, checkin);
        if (!iso) return NextResponse.json({ ok: false, error: "Invalid check-in time" }, { status: 400 });
        payload.checkinISO = iso;
      }
      if (detail !== undefined) payload.jobDetail = detail;
      if (Object.keys(payload).length > 0) {
        await updateTableRowByIndex(graphTables.checkin(), checkinRowIndex, payload);
        updateTargets.push("checkin");
      }
    }

    // Check-out updates
    if (checkout != null || problemDetail != null || remark != null) {
      if (checkoutRowIndex == null || checkoutRowIndex < 0) {
        return NextResponse.json({ ok: false, error: "Missing check-out row index" }, { status: 400 });
      }
      const payload: Record<string, any> = {};
      if (checkout !== undefined) {
        const iso = buildIso(date, checkout);
        if (!iso) return NextResponse.json({ ok: false, error: "Invalid check-out time" }, { status: 400 });
        payload.checkoutISO = iso;
      }
      if (problemDetail !== undefined) {
        payload.problemDetail = problemDetail;
        payload.problem = problemDetail;
      }
      if (remark !== undefined) {
        payload.jobRemark = remark;
        payload.remark = remark;
      }
      if (Object.keys(payload).length > 0) {
        await updateTableRowByIndex(graphTables.checkout(), checkoutRowIndex, payload);
        updateTargets.push("checkout");
      }
    }

    if (updateTargets.length === 0) {
      return NextResponse.json({ ok: false, error: "No changes to apply" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, updated: updateTargets });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to update report row" }, { status: 500 });
  }
}
