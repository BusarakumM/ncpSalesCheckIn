"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitCheckin, submitCheckout, uploadPhoto } from "@/lib/paClient";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [checkinTime, setCheckinTime] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [displayTitle, setDisplayTitle] = useState<string>("Task");
  const [locationName, setLocationName] = useState("");
  const [gps, setGps] = useState<string>("");
  const [checkinAddress, setCheckinAddress] = useState<string>("");
  const [checkoutGps, setCheckoutGps] = useState<string>("");
  const [checkoutAddress, setCheckoutAddress] = useState<string>("");
  const [jobDetail, setJobDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [checkoutPhotoUrl, setCheckoutPhotoUrl] = useState<string | null>(null);
  const [checkoutPhotoFile, setCheckoutPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const galleryFileRef = useRef<HTMLInputElement | null>(null);
  const checkoutFileRef = useRef<HTMLInputElement | null>(null);
  const checkoutGalleryFileRef = useRef<HTMLInputElement | null>(null);
  const [hasExistingCheckin, setHasExistingCheckin] = useState(false);
  const [hasExistingCheckout, setHasExistingCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Place picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<Array<{ name: string; address?: string; lat?: number; lon?: number }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  // Inline typeahead suggestions
  const [suggestions, setSuggestions] = useState<Array<{ name: string; address?: string; lat?: number; lon?: number }>>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Try to load existing task by stable key (email|date|location); otherwise default time to now
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let decoded = "";
        try { decoded = typeof atob === 'function' ? atob(decodeURIComponent(id)) : ""; } catch {}
        const parts = decoded.split("|");
        const email = parts[0] || "";
        const date = parts[1] || "";
        const location = parts.slice(2).join("|");
        if (date || location) {
          const dDisp = date ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
          setDisplayTitle([location || "Task", dDisp].filter(Boolean).join(" — "));
        }
        if (email && date) {
          const res = await fetch('/api/pa/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: date, to: date, email }) });
          const data = await res.json();
          if (res.ok && data?.ok && Array.isArray(data.rows)) {
            const row = (data.rows as any[]).find((r) => (r.location || "") === (location || ""));
            if (row && !cancelled) {
              // Preload name from existing row
              setLocationName(row.location || "");
              setGps(row.checkinGps || "");
              setCheckoutGps(row.checkoutGps || "");
              setJobDetail(row.detail || "");
              if (row.imageIn) setPhotoUrl(row.imageIn);
              if (row.imageOut) setCheckoutPhotoUrl(row.imageOut);
              const toLocalInput = (d: string, t?: string) => {
                if (!d || !t) return "";
                const [hh, mm] = String(t).split(":");
                const dt = new Date(`${d}T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:00`);
                const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0,16);
                return isoLocal;
              };
              setCheckinTime(toLocalInput(row.date, row.checkin));
              setCheckoutTime(toLocalInput(row.date, row.checkout));
              setHasExistingCheckin(!!row.checkin);
              setHasExistingCheckout(!!row.checkout);
              return;
            }
          }
        }
      } catch {}
      if (!cancelled) {
        const now = new Date();
        const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        setCheckinTime(isoLocal);
        setHasExistingCheckin(false);
        setHasExistingCheckout(false);
        setDisplayTitle("New Task");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const res = await fetch(`/api/maps/geocode?lat=${lat}&lon=${lon}`, { cache: "no-store" });
      if (!res.ok) return "";
      const data = await res.json();
      return data?.address || "";
    } catch {
      return "";
    }
  }

  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY as string | undefined;
  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=320x200&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }

  function captureGPS() {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        const coord = `${lat}, ${lon}`;
        setGps(coord);
        (async () => {
          try {
            const near = await fetch(`/api/maps/nearby?lat=${lat}&lon=${lon}`, { cache: "no-store" });
            if (near.ok) {
              const j = await near.json();
              if (j?.ok && j?.name) setLocationName(j.name);
            }
          } catch {}
          const addr = await reverseGeocode(parseFloat(lat), parseFloat(lon));
          setCheckinAddress(addr || "");
          if (!locationName && addr) setLocationName(addr);
        })();
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // Typeahead search when typing in Location input
  useEffect(() => {
    const q = locationName.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    let cancelled = false;
    const h = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        let lat: string | undefined;
        let lon: string | undefined;
        const parts = gps.split(',');
        if (parts.length >= 2) {
          lat = parts[0].trim();
          lon = parts[1].trim();
        }
        const url = `/api/maps/search?q=${encodeURIComponent(q)}${lat && lon ? `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          const arr = Array.isArray(data?.results) ? data.results : [];
          setSuggestions(arr);
          setSuggestOpen(arr.length > 0);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestOpen(false);
        }
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(h); };
  }, [locationName, gps]);

  async function searchPlaces() {
    if (!placeQuery.trim()) return;
    try {
      setPickerLoading(true);
      const url = `/api/maps/search?q=${encodeURIComponent(placeQuery.trim())}${gps ? `&lat=${encodeURIComponent(gps.split(',')[0].trim())}&lon=${encodeURIComponent(gps.split(',')[1].trim())}` : ''}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data?.ok && Array.isArray(data.results)) {
        setPlaceResults(data.results);
      } else if (res.ok && Array.isArray(data.results)) {
        setPlaceResults(data.results);
      } else {
        setPlaceResults([]);
      }
    } catch {
      setPlaceResults([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function loadNearby() {
    try {
      setPickerLoading(true);
      let lat: string | null = null;
      let lon: string | null = null;
      if (gps) {
        const parts = gps.split(",");
        if (parts.length >= 2) {
          lat = parts[0].trim();
          lon = parts[1].trim();
        }
      }
      if (!lat || !lon) {
        await new Promise<void>((resolve) => {
          if (!("geolocation" in navigator)) return resolve();
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude.toFixed(6);
              lon = pos.coords.longitude.toFixed(6);
              setGps(`${lat}, ${lon}`);
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
      const q = lat && lon ? `?lat=${lat}&lon=${lon}&full=1` : "";
      const res = await fetch(`/api/maps/nearby${q}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data?.ok && Array.isArray(data.results)) {
        setPlaceResults(data.results);
      } else {
        setPlaceResults([]);
      }
    } catch {
      setPlaceResults([]);
    } finally {
      setPickerLoading(false);
    }
  }

  function selectPlace(p: { name: string; address?: string; lat?: number; lon?: number }) {
    if (p.lat != null && p.lon != null) {
      const coord = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
      setGps(coord);
      setCheckinAddress(p.address || "");
    }
    setLocationName(p.name);
    setPickerOpen(false);
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
    setPhotoFile(f);
  }

  function captureCheckoutGPS() {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        const coord = `${lat}, ${lon}`;
        setCheckoutGps(coord);
        reverseGeocode(parseFloat(lat), parseFloat(lon)).then((addr) => setCheckoutAddress(addr || ""));
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function onPickCheckoutPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCheckoutPhotoUrl(url);
    setCheckoutPhotoFile(f);
  }

  function onCheckout() {
    const now = new Date();
    const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCheckoutTime(isoLocal);
  }

  async function onSubmitCheckin() {
    try {
      setIsSubmitting(true);
      let uploadedUrl: string | null = null;
      if (photoFile) uploadedUrl = await uploadPhoto(photoFile);
      const resp = await submitCheckin({
        id,
        checkin: checkinTime,
        locationName,
        gps,
        checkinAddress,
        jobDetail,
        photoUrl: uploadedUrl,
      });
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `Saved (${st})` : "Saved");
      setHasExistingCheckin(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmitCheckout() {
    try {
      setIsSubmitting(true);
      let uploadedUrl: string | null = null;
      if (checkoutPhotoFile) uploadedUrl = await uploadPhoto(checkoutPhotoFile);
      const resp = await submitCheckout({
        id,
        checkout: checkoutTime,
        checkoutGps,
        checkoutAddress,
        locationName,
        checkoutPhotoUrl: uploadedUrl,
      });
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `Saved (${st})` : "Saved");
      setHasExistingCheckout(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        {/* Header with back icon */}
        <div className="mb-2 flex items-center gap-2">
          <Link
            href="/checkin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Back"
          >
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            {displayTitle}
          </h1>
        </div>

        {/* Check-in time */}
        <div className="mt-3">
          <div className="text-sm sm:text-base font-semibold">Check-in Time :</div>
          <div className="mt-1">
            <Input
              type="datetime-local"
              value={checkinTime}
              onChange={(e) => setCheckinTime(e.target.value)}
              className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
              disabled={hasExistingCheckin || isSubmitting}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm sm:text-base font-semibold">Location</div>
          <div className="mt-2">
            <Input
              value={locationName}
              onChange={(e) => { setLocationName(e.target.value); }}
              placeholder="Enter or pick a place"
              className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
              disabled={hasExistingCheckin || isSubmitting}
              onFocus={() => { if (suggestions.length > 0) setSuggestOpen(true); }}
              onBlur={() => { setTimeout(() => setSuggestOpen(false), 120); }}
            />
            {suggestOpen && suggestions.length > 0 && (
              <div className="mt-1 max-h-64 overflow-auto divide-y divide-black/10 bg-white rounded border border-black/10">
                {suggestLoading && suggestions.length === 0 ? (
                  <div className="p-2 text-sm">Searching…</div>
                ) : (
                  suggestions.slice(0, 10).map((p, i) => (
                    <button
                      key={`${p.name}-${i}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLocationName(p.name);
                        if (p.lat != null && p.lon != null) {
                          const coord = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
                          setGps(coord);
                          setCheckinAddress(p.address || '');
                        }
                        setSuggestOpen(false);
                      }}
                      className="w-full text-left p-2 hover:bg-[#F0F5F2]"
                    >
                      <div className="font-medium truncate">{p.name}</div>
                      {p.address ? <div className="text-xs text-gray-600 truncate">{p.address}</div> : null}
                    </button>
                  ))
                )}
              </div>
            )}
            {!locationName.trim() ? (
              <div className="mt-1 text-xs text-red-700">Please pick or enter a location</div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => { setPickerOpen((v) => !v); if (!pickerOpen) { setPlaceResults([]); } }}
                className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                disabled={hasExistingCheckin || isSubmitting}
                title="Search or pick nearby place"
              >
                Pick place
              </button>
              <button
                type="button"
                onClick={loadNearby}
                className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                disabled={hasExistingCheckin || isSubmitting}
                title="Load nearby places"
              >
                Nearby
              </button>
            </div>
            {pickerOpen && (
              <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search place (e.g., mall, company)"
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    className="h-9 rounded-full border-black/10 bg-white"
                  />
                  <button type="button" onClick={searchPlaces} className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm hover:bg-gray-50" disabled={pickerLoading}>Search</button>
                </div>
                <div className="mt-2 max-h-56 overflow-auto divide-y divide-black/10 bg-white rounded">
                  {pickerLoading ? (
                    <div className="p-3 text-sm">Loading…</div>
                  ) : placeResults.length === 0 ? (
                    <div className="p-3 text-sm text-gray-700">No results</div>
                  ) : (
                    placeResults.map((p, i) => (
                      <div key={`${p.name}-${i}`} className="p-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          {p.address ? <div className="text-xs text-gray-600 truncate">{p.address}</div> : null}
                        </div>
                        <button type="button" onClick={() => selectPlace(p)} className="rounded-full border border-black/20 bg-white px-3 py-1 text-sm hover:bg-gray-50">Select</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="mt-1 text-xs text-gray-700">Tip: pick a place and edit the name before saving</div>
          </div>
        </div>

        {/* Selected Location details */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <div className="text-sm sm:text-base font-semibold">Selected Location</div>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="ml-auto inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-2 py-1 text-xs hover:bg-gray-50"
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
          </div>
          <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4">
            <div className="text-sm sm:text-base font-semibold">
              {locationName || "— No place selected"}
            </div>
            {showDetails && (
              <div className="mt-2">
                <div className="text-xs sm:text-sm break-words">GPS: {gps || "—"}</div>
                {checkinAddress ? (
                  <div className="mt-1 text-xs sm:text-sm text-gray-700 break-words" title={checkinAddress}>
                    {checkinAddress}
                  </div>
                ) : null}
                {gps && GMAPS_KEY ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mapUrl(gps)} alt="check-in map" className="mt-2 rounded border border-black/10" />
                ) : null}
              </div>
            )}
            <div className="mt-2 text-xs text-gray-700">Use Pick place or Nearby to choose a location, then edit the name if needed.</div>
          </div>
        </div>

        {/* Job Detail */}
        <div className="mt-5">
          <div className="text-sm sm:text-base font-semibold">Job Detail</div>
          <Textarea
            value={jobDetail}
            onChange={(e) => setJobDetail(e.target.value)}
            className="mt-2 min-h-[160px] sm:min-h-[180px] border-black/10 bg-[#BFD9C8]"
            disabled={hasExistingCheckin || isSubmitting}
          />
        </div>

        {/* Take a picture bar */}
        <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
          <span className="text-sm sm:text-base">Take a picture</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Open camera" disabled={hasExistingCheckin || isSubmitting}
          >
            📷
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
            disabled={hasExistingCheckin || isSubmitting}
          />
          <button
            type="button"
            onClick={() => galleryFileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Attach from gallery"
            disabled={hasExistingCheckin || isSubmitting}
          >
            Attach photo
          </button>
          <input
            ref={galleryFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickPhoto}
            disabled={hasExistingCheckin || isSubmitting}
          />
        </div>

        {/* Status label */}
        <div className="-mt-1 mb-2 flex justify-center">
          {hasExistingCheckin ? (
            hasExistingCheckout ? (
              <span className="inline-flex items-center rounded-full bg-[#6EC3A1] text-white px-3 py-1 text-xs sm:text-sm">Completed</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#E7D6B9] text-black px-3 py-1 text-xs sm:text-sm">Ongoing</span>
            )
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-800 px-3 py-1 text-xs sm:text-sm">Not started</span>
          )}
        </div>

        {/* Photo preview (kept stable with aspect ratio) */}
        <div className="mt-3 overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
          <div className="relative w-full aspect-video">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="preview" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-sm sm:text-base text-gray-700">
                No photo
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={onSubmitCheckin}
            disabled={hasExistingCheckin || !locationName.trim() || isSubmitting}
            className="w-full rounded-full bg-[#BFD9C8] px-6 text-gray-900 hover:bg-[#b3d0bf] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
            title={!locationName.trim() ? "Please enter a location name" : hasExistingCheckin ? "Check-in already submitted" : undefined}
          >
            Submit Check-in
          </Button>
          <Button
            onClick={onCheckout}
            className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={hasExistingCheckout || isSubmitting}
          >
            Check-out
          </Button>
        </div>

        {/* Check-out time (wraps nicely on small screens) */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="text-sm sm:text-base font-semibold">Check-out Time :</div>
          <Input
            type="datetime-local"
            value={checkoutTime}
            onChange={(e) => setCheckoutTime(e.target.value)}
            className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11 w-full sm:w-[260px]"
            disabled={hasExistingCheckout || isSubmitting}
          />
        </div>

        {/* Checkout GPS and Photo (shown after checkout time set) */}
        {checkoutTime && (
          <>
            {/* Checkout GPS */}
            <div className="mt-4">
              <div className="text-sm sm:text-base font-semibold">Checkout GPS</div>
              <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4">
                <div className="text-sm sm:text-base break-words">{checkoutGps || "—"}</div>
                {checkoutAddress ? (
                  <div className="mt-1 text-xs sm:text-sm text-gray-700 break-words" title={checkoutAddress}>
                    {checkoutAddress}
                  </div>
                ) : null}
                {checkoutGps && GMAPS_KEY ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mapUrl(checkoutGps)} alt="checkout map" className="mt-2 rounded border border-black/10" />
                ) : null}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => { if (gps) setCheckoutGps(gps); if (checkinAddress) setCheckoutAddress(checkinAddress); }}
                    className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                    disabled={hasExistingCheckout || isSubmitting}
                    title="Use the same location as Check-in"
                  >
                    Use check-in location
                  </button>
                </div>
              </div>
            </div>

            {/* Checkout Take a picture bar */}
            <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
              <span className="text-sm sm:text-base">Checkout picture</span>
              <button
                type="button"
                onClick={() => checkoutFileRef.current?.click()}
                className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Open camera"
                disabled={hasExistingCheckout || isSubmitting}
              >
                ??
              </button>
              <input
                ref={checkoutFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPickCheckoutPhoto}
                disabled={hasExistingCheckout || isSubmitting}
              />
              <button
                type="button"
                onClick={() => checkoutGalleryFileRef.current?.click()}
                className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Attach from gallery"
                disabled={hasExistingCheckout || isSubmitting}
              >
                Attach photo
              </button>
              <input
                ref={checkoutGalleryFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickCheckoutPhoto}
                disabled={hasExistingCheckout || isSubmitting}
              />
            </div>

            {/* Checkout Photo preview */}
            <div className="mt-3 overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
              <div className="relative w-full aspect-video">
                {checkoutPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={checkoutPhotoUrl} alt="checkout preview" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-sm sm:text-base text-gray-700">
                    No photo
                  </div>
                )}
              </div>
            </div>

            {/* Submit Checkout */}
            <div className="mt-4">
              <Button
                onClick={onSubmitCheckout}
                disabled={hasExistingCheckout || !locationName.trim() || isSubmitting}
                className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Submit Checkout
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



