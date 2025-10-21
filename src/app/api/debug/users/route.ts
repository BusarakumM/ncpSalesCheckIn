import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { graphTables, getTableValues } from "@/lib/graph";
import { findUserByEmail } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const c = await cookies();
    const role = c.get("role")?.value;
    if (role !== "SUPERVISOR") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || undefined;

    const tbl = graphTables.users();
    const rows = await getTableValues(tbl);
    const sample = rows.slice(0, 10);
    const match = q ? await findUserByEmail(q) : null;

    return NextResponse.json({ ok: true, table: tbl, sampleCount: sample.length, sample, match });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to read users" }, { status: 500 });
  }
}

