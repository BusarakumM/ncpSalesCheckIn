import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Text search for places by name/keywords; optional location bias via lat/lon.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") || "").trim();
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const radiusParam = url.searchParams.get("radius");
  const radius = Math.max(50, Math.min(2000, Number(radiusParam) || 500));

  if (!query) {
    return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });
  }

  const key =
    process.env.GOOGLE_MAPS_PLACES_KEY ||
    process.env.GOOGLE_MAPS_GEOCODING_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing Google Maps API key" }, { status: 500 });
  }

  try {
    const endpoint = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    endpoint.searchParams.set("query", query);
    if (lat && lon) {
      endpoint.searchParams.set("location", `${lat},${lon}`);
      endpoint.searchParams.set("radius", String(radius));
    }
    endpoint.searchParams.set("key", key);

    const r = await fetch(endpoint.toString(), {
      cache: "no-store",
      headers: {
        ...(url.origin ? { Referer: url.origin } : {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Places search failed ${r.status}: ${txt}` }, { status: 502 });
    }
    const data = (await r.json()) as any;
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const simplified = results.slice(0, 20).map((p) => ({
      name: p?.name as string | undefined,
      address: p?.formatted_address || p?.vicinity || "",
      lat: p?.geometry?.location?.lat as number | undefined,
      lon: p?.geometry?.location?.lng as number | undefined,
    })).filter((p) => !!p.name);

    return NextResponse.json({ ok: true, results: simplified });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Places search error" }, { status: 500 });
  }
}

