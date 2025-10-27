import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Find a nearby place name (e.g., mall/company) for a coordinate using Google Places Nearby Search.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const radiusParam = url.searchParams.get("radius");
  const radius = Math.max(50, Math.min(1000, Number(radiusParam) || 200)); // clamp radius 50-1000m

  if (!lat || !lon) {
    return NextResponse.json({ ok: false, error: "Missing lat/lon" }, { status: 400 });
  }

  const key =
    process.env.GOOGLE_MAPS_PLACES_KEY ||
    process.env.GOOGLE_MAPS_GEOCODING_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing Google Maps API key" }, { status: 500 });
  }

  try {
    const endpoint = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    endpoint.searchParams.set("location", `${lat},${lon}`);
    endpoint.searchParams.set("radius", String(radius));
    // Bias toward commercial POIs but still allow generic POIs
    endpoint.searchParams.set(
      "type",
      // Common POI types likely relevant to sales support
      "point_of_interest"
    );
    endpoint.searchParams.set("key", key);

    const r = await fetch(endpoint.toString(), {
      cache: "no-store",
      headers: {
        ...(url.origin ? { Referer: url.origin } : {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Places failed ${r.status}: ${txt}` }, { status: 502 });
    }
    const data = (await r.json()) as any;
    const results: any[] = Array.isArray(data?.results) ? data.results : [];

    if (results.length === 0) {
      return NextResponse.json({ ok: true, name: "" }, { status: 200 });
    }

    // Prefer specific commercial categories
    const preferredOrder = [
      "shopping_mall",
      "department_store",
      "supermarket",
      "convenience_store",
      "store",
      "office",
      "bank",
      "hospital",
      "school",
      "university",
      "transit_station",
      "point_of_interest",
      "establishment",
    ];

    function scoreTypes(types?: string[]): number {
      if (!types || !types.length) return -1;
      for (let i = 0; i < preferredOrder.length; i++) {
        if (types.includes(preferredOrder[i])) return preferredOrder.length - i;
      }
      return 0;
    }

    const sorted = results
      .map((p) => ({
        name: p?.name as string | undefined,
        vicinity: p?.vicinity as string | undefined,
        rating: typeof p?.rating === "number" ? p.rating : 0,
        types: Array.isArray(p?.types) ? (p.types as string[]) : [],
      }))
      .filter((p) => !!p.name)
      .sort((a, b) => {
        const ts = scoreTypes(b.types) - scoreTypes(a.types);
        if (ts !== 0) return ts;
        // tie-break by rating
        return (b.rating || 0) - (a.rating || 0);
      });

    const top = sorted[0];
    if (!top) {
      return NextResponse.json({ ok: true, name: "" });
    }
    const display = top.vicinity && !top.name?.includes(top.vicinity)
      ? `${top.name} — ${top.vicinity}`
      : top.name || "";

    return NextResponse.json({ ok: true, name: display, source: "places" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Places error" }, { status: 500 });
  }
}
