import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasMapsKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;
  const raw = process.env.NEXT_PUBLIC_MAX_DISTANCE_KM;
  const maxDistanceKm = raw ? Number(raw) : null;
  return NextResponse.json({ ok: true, hasMapsKey, maxDistanceKm });
}

