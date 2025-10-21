import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { graphTables, getTableHeaders, getTableValues } from "@/lib/graph";

export const runtime = "nodejs";

async function sampleFor(tableName: string) {
  try {
    const [headers, rows] = await Promise.all([
      getTableHeaders(tableName),
      getTableValues(tableName),
    ]);
    return {
      ok: true,
      headers,
      totalRows: rows.length,
      sample: rows.slice(0, 5),
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "read failed" };
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || "";
    const c = await cookies();
    const role = c.get("role")?.value;
    const debugKey = process.env.DEBUG_KEY || "";
    if (!(role === "SUPERVISOR" || (debugKey && key === debugKey))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const siteId = process.env.GRAPH_SITE_ID || "";
    const workbookPath = process.env.GRAPH_WORKBOOK_PATH || "";

    const usersTbl = graphTables.users();
    const checkinTbl = graphTables.checkin();
    const checkoutTbl = graphTables.checkout();
    const leaveTbl = graphTables.leave();

    const [users, checkin, checkout, leave] = await Promise.all([
      sampleFor(usersTbl),
      sampleFor(checkinTbl),
      sampleFor(checkoutTbl),
      sampleFor(leaveTbl),
    ]);

    return NextResponse.json({
      ok: true,
      siteId,
      workbookPath,
      tables: {
        users: { table: usersTbl, ...users },
        checkin: { table: checkinTbl, ...checkin },
        checkout: { table: checkoutTbl, ...checkout },
        leave: { table: leaveTbl, ...leave },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Workbook debug failed" }, { status: 500 });
  }
}
