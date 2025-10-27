import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    return NextResponse.json({ ok: false, error: "Missing lat/lon" }, { status: 400 });
  }
  const key = process.env.GOOGLE_MAPS_GEOCODING_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing Google Maps API key" }, { status: 500 });
  }
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${key}`, {
      cache: "no-store",
      // Add Referer to satisfy referrer-restricted browser keys if you choose a single key
      headers: {
        ...(url.origin ? { Referer: url.origin } : {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Geocode failed ${r.status}: ${txt}` }, { status: 502 });
    }
    const data = (await r.json()) as any;
    const address = data?.results?.[0]?.formatted_address || "";
    return NextResponse.json({ ok: true, address });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Geocode error" }, { status: 500 });
  }
}
