"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitCheckin, submitCheckout, uploadPhoto } from "@/lib/paClient";
import { useRouter } from "next/navigation";

export default function NewTaskPage() {
  const router = useRouter();
  const [checkinTime, setCheckinTime] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [gps, setGps] = useState("");
  const [checkinAddress, setCheckinAddress] = useState("");
  const [checkoutGps, setCheckoutGps] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDetail, setJobDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [checkoutPhotoUrl, setCheckoutPhotoUrl] = useState<string | null>(null);
  const [checkoutPhotoFile, setCheckoutPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const galleryFileRef = useRef<HTMLInputElement | null>(null);
  const checkoutFileRef = useRef<HTMLInputElement | null>(null);
  const checkoutGalleryFileRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCheckin, setSubmittedCheckin] = useState(false);
  const [submittedCheckout, setSubmittedCheckout] = useState(false);
  // Place picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<Array<{ name: string; address?: string; lat?: number; lon?: number }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Prefill current datetime as check-in time
  useEffect(() => {
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16); // yyyy-MM-ddTHH:mm
    setCheckinTime(iso);
  }, []);

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

  function getGPS() {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        const coord = `${lat}, ${lon}`;
        setGps(coord);
        // Try nearby place name first; fallback to reverse geocode formatted address
        (async () => {
          try {
            const near = await fetch(`/api/maps/nearby?lat=${lat}&lon=${lon}`, { cache: "no-store" });
            if (near.ok) {
              const j = await near.json();
              if (j?.ok && j?.name) setLocationNameAuto(j.name);
            }
          } catch {}
          const addr = await reverseGeocode(parseFloat(lat), parseFloat(lon));
          setCheckinAddress(addr || "");
          if (!locationNameAuto && addr) setLocationNameAuto(addr);
        })();
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

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
      // If we don't have gps yet, try to capture for better nearby suggestions
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
        // try to get geolocation silently via prompt
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

  function getCheckoutGPS() {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not supported");
      return;
    }
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

  async function onSubmitCheckin() {
    try {
      let uploadedUrl: string | null = null;
      if (photoFile) uploadedUrl = await uploadPhoto(photoFile);
      setIsSubmitting(true);
      const resp = await submitCheckin({
        checkin: checkinTime,
        locationName,
        gps,
        checkinAddress,
        jobTitle,
        jobDetail,
        photoUrl: uploadedUrl,
      });
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `Saved (${st})` : "Saved");
      setSubmittedCheckin(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onCheckout() {
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCheckoutTime(iso);
  }

  async function onSubmitCheckout() {
    try {
      let uploadedUrl: string | null = null;
      if (checkoutPhotoFile) uploadedUrl = await uploadPhoto(checkoutPhotoFile);
      setIsSubmitting(true);
      const resp = await submitCheckout({
        checkout: checkoutTime,
        checkoutGps,
        checkoutAddress,
        checkoutPhotoUrl: uploadedUrl,
        locationName,
      });
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `Saved (${st})` : "Saved");
      setSubmittedCheckout(true);
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
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/checkin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Back"
          >
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            New Task
          </h1>
        </div>

        {/* Check-in time */}
        <div className="mt-2">
          <div className="text-sm sm:text-base font-semibold">Check-in Time :</div>
          <Input
            type="datetime-local"
            value={checkinTime}
            onChange={(e) => setCheckinTime(e.target.value)}
            className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
            disabled={isSubmitting || submittedCheckin}
          />
        </div>

        <div className="mt-4">
          <div className="text-sm sm:text-base font-semibold">Location Name</div>
          <div className="mt-2">
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Enter or pick a place"
              className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
              disabled={isSubmitting || submittedCheckin}
            />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-black/20 bg-white hover:bg-gray-50"
                onClick={() => { setPickerOpen((v) => !v); if (!pickerOpen) { setPlaceResults([]); } }}
                disabled={isSubmitting || submittedCheckin}
                title="Search or pick nearby place"
              >
                Pick place
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-black/20 bg-white hover:bg-gray-50"
                onClick={loadNearby}
                disabled={isSubmitting || submittedCheckin}
                title="Load nearby places"
              >
                Nearby
              </Button>
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
                  <Button type="button" className="rounded-full" onClick={searchPlaces} disabled={pickerLoading}>Search</Button>
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
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => selectPlace(p)}>Select</Button>
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
          <div className="text-sm sm:text-base font-semibold">Selected Location</div>
          <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4 min-h-[140px]">
            <div className="text-sm sm:text-base break-words" title={gps || undefined}>{gps || "—"}</div>
            {checkinAddress ? (
              <div className="mt-1 text-xs sm:text-sm text-gray-700 break-words" title={checkinAddress}>
                {checkinAddress}
              </div>
            ) : null}
            {gps && GMAPS_KEY ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mapUrl(gps)} alt="check-in map" className="mt-2 rounded border border-black/10" />
            ) : null}
            <div className="mt-2 text-xs text-gray-700">Use "Pick place" or "Nearby" above to select.</div>
          </div>
        </div>

        {/* Job Detail */}
        <div className="mt-5">
          <div className="text-sm sm:text-base font-semibold">Job Detail</div>
          <Input
            placeholder="Title / short description"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
            disabled={isSubmitting || submittedCheckin}
          />
          <Textarea
            placeholder="More details…"
            value={jobDetail}
            onChange={(e) => setJobDetail(e.target.value)}
            className="mt-3 min-h-[160px] sm:min-h-[180px] border-black/10 bg-[#BFD9C8]"
          />
        </div>

        {/* Take a picture */}
        <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
          <span className="text-sm sm:text-base">Take a picture</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
           disabled={isSubmitting || submittedCheckin}>
            📷
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto} disabled={isSubmitting || submittedCheckin}
          />
          <button
            type="button"
            onClick={() => galleryFileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Attach from gallery"
           disabled={isSubmitting || submittedCheckin}>
            Attach photo
          </button>
          <input
            ref={galleryFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickPhoto} disabled={isSubmitting || submittedCheckin}
          />
        </div>

        {/* Photo preview */}
        <div className="mt-3 overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
          <div className="relative w-full aspect-video">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-sm sm:text-base text-gray-700">
                No photo
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={onSubmitCheckin}
            className="w-full rounded-full bg-[#BFD9C8] px-6 text-gray-900 hover:bg-[#b3d0bf] border border-black/20"
          >
            Submit Check-in
          </Button>
          <Button
            onClick={onCheckout}
            className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
          >
            Check-out
          </Button>
        </div>

        {/* Checkout time */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="text-sm sm:text-base font-semibold">Check-out Time :</div>
          <Input
            type="datetime-local"
            value={checkoutTime}
            onChange={(e) => setCheckoutTime(e.target.value)}
            className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11 w-full sm:w-[260px]"
          />
        </div>

        {/* Checkout GPS and Photo (shown after checkout time set) */}
        {checkoutTime && (
          <>
            {/* Checkout GPS */}
            <div className="mt-4">
              <div className="text-sm sm:text-base font-semibold">Checkout GPS</div>
              <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4 min-h-[140px]">
                <div className="text-sm sm:text-base break-words" title={checkoutGps || undefined}>{checkoutGps || "�"}</div>
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
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-black/20 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => { if (gps) setCheckoutGps(gps); if (checkinAddress) setCheckoutAddress(checkinAddress); }}
                    disabled={isSubmitting || submittedCheckin}
                    title="Use the same location as Check-in"
                  >
                    Use check-in location
                  </Button>
                </div>
              </div>
            </div>

            {/* Checkout Take a picture */}
            <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
              <span className="text-sm sm:text-base">Checkout picture</span>
              <button
                type="button"
                onClick={() => checkoutFileRef.current?.click()}
                className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >\n                disabled={isSubmitting || submittedCheckout}
                📷
              </button>
              <input
                ref={checkoutFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPickCheckoutPhoto} disabled={isSubmitting || submittedCheckout}
              />
              <button
                type="button"
                onClick={() => checkoutGalleryFileRef.current?.click()}
                className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Attach from gallery"
              >\n                disabled={isSubmitting || submittedCheckout}
                Attach photo
              </button>
              <input
                ref={checkoutGalleryFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickCheckoutPhoto} disabled={isSubmitting || submittedCheckout}
              />
            </div>

            {/* Checkout Photo preview */}
            <div className="mt-3 overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
              <div className="relative w-full aspect-video">
                {checkoutPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checkoutPhotoUrl}
                    alt="checkout preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
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
                className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
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











