import { NextResponse } from "next/server";
import { healthCheckGraph } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await healthCheckGraph();
    const ok = status.token && status.workbook && status.uploadFolder && Object.values(status.tables).every(Boolean);
    return NextResponse.json({ ok, status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Health check failed" }, { status: 500 });
  }
}

