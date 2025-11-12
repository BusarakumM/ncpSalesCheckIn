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
  const [locationError, setLocationError] = useState<string>("");
  const [sameLocationWarning, setSameLocationWarning] = useState<string>("");
  const [sameLocationExistingId, setSameLocationExistingId] = useState<string | null>(null);
  const [gps, setGps] = useState("");
  const [checkinAddress, setCheckinAddress] = useState("");
  const [checkoutGps, setCheckoutGps] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [jobDetail, setJobDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [checkoutPhotoUrl, setCheckoutPhotoUrl] = useState<string | null>(null);
  const [checkoutPhotoFile, setCheckoutPhotoFile] = useState<File | null>(null);
  const [checkoutRemark, setCheckoutRemark] = useState("");
  const [problemDetail, setProblemDetail] = useState("");
  const [jobRemark, setJobRemark] = useState("");
  const [checkinPhotoTakenAt, setCheckinPhotoTakenAt] = useState<number | null>(null);
  const [checkoutPhotoTakenAt, setCheckoutPhotoTakenAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const checkoutFileRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Click locks to prevent rapid double submissions
  const checkinLockRef = useRef(false);
  const checkoutLockRef = useRef(false);
  const [submittedCheckin, setSubmittedCheckin] = useState(false);
  const [submittedCheckout, setSubmittedCheckout] = useState(false);
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
  const [checkoutOutOfArea, setCheckoutOutOfArea] = useState(false);
  const [checkinCaptureAt, setCheckinCaptureAt] = useState<number | null>(null);
  // Auto-expire check-in location/GPS if not submitted within 10 minutes
  const checkinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function todayUtcDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\\/\+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function clearCheckinTimeout() {
    if (checkinTimeoutRef.current) {
      clearTimeout(checkinTimeoutRef.current);
      checkinTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    // Start or reset a 10-minute timer when both location and GPS are present and check-in not yet submitted
    clearCheckinTimeout();
    if (!submittedCheckin && locationName.trim() && gps.trim()) {
      checkinTimeoutRef.current = setTimeout(() => {
        // Timeout reached: clear location + GPS and notify user
        setLocationName("");
        setGps("");
        setCheckinAddress("");
        alert("submit check-in timeout");
      }, 5 * 60 * 1000);
    }
    return () => {
      clearCheckinTimeout();
    };
  }, [locationName, gps, submittedCheckin]);

  // Prefill current datetime as check-in time (display only; actual submit uses real-time now)
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

  function isCheckinExpired(): boolean {
    return checkinCaptureAt != null && Date.now() - checkinCaptureAt > 5 * 60 * 1000;
  }

  function toLatLonPair(coord?: string): [number, number] | null {
    if (!coord) return null;
    const parts = coord.split(',');
    if (parts.length < 2) return null;
    const lat = Number(parts[0].trim());
    const lon = Number(parts[1].trim());
    if (!isFinite(lat) || !isFinite(lon)) return null;
    return [lat, lon];
  }

  function distanceKm(a: [number, number], b: [number, number]) {
    const R = 6371; // km
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLon = (b[1] - a[1]) * Math.PI / 180;
    const la1 = a[0] * Math.PI / 180;
    const la2 = b[0] * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }

  function maxDistanceKm(): number {
    const v = (process.env.NEXT_PUBLIC_MAX_DISTANCE_KM as unknown as string) || "0.5";
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0.5;
  }

  async function geocodeByName(name: string, bias?: { lat?: string; lon?: string }): Promise<[number, number] | null> {
    try {
      const q = name.trim();
      if (!q) return null;
      const url = `/api/maps/search?q=${encodeURIComponent(q)}${bias?.lat && bias?.lon ? `&lat=${encodeURIComponent(bias.lat)}&lon=${encodeURIComponent(bias.lon)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({} as any));
      const r = Array.isArray(data?.results) && data.results.length > 0 ? data.results[0] : null;
      if (r && typeof r.lat === 'number' && typeof r.lon === 'number') return [r.lat, r.lon];
      return null;
    } catch {
      return null;
    }
  }

  async function getCurrentPositionOnce(): Promise<[number, number] | null> {
    if (!("geolocation" in navigator)) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  }

  async function validateLocationMatch(nameArg?: string): Promise<boolean> {
    const name = (nameArg ?? locationName).trim();
    if (!name) return false;
    const curr = await getCurrentPositionOnce();
    if (!curr) {
      setLocationError("พิกัดไม่ตรง กรุณาใส่พิกัดใหม่ให้ถูกต้อง");
      setLocationName("");
      return false;
    }
    const [ulat, ulon] = curr;
    const place = await geocodeByName(name, { lat: String(ulat), lon: String(ulon) });
    if (!place) {
      setLocationError("พิกัดไม่ตรง กรุณาใส่พิกัดใหม่ให้ถูกต้อง");
      setLocationName("");
      return false;
    }
    const d = distanceKm([ulat, ulon], place);
    if (d > maxDistanceKm()) {
      setLocationError("พิกัดไม่ตรง กรุณาใส่พิกัดใหม่ให้ถูกต้อง");
      setLocationName("");
      return false;
    }
    setLocationError("");
    return true;
  }

  async function validateNoOngoingSameLocation(nameArg?: string): Promise<boolean> {
    const name = (nameArg ?? locationName).trim();
    if (!name) return false;
    try {
      // Try resolve current user's identity from cookies
      const identity = getCookie('username') || getCookie('email') || undefined;
      const payload: any = { from: todayUtcDate(), to: todayUtcDate() };
      if (identity) payload.email = identity;
      const res = await fetch('/api/pa/activity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store'
      });
      if (!res.ok) return true; // don't block if cannot verify
      const data = await res.json().catch(() => ({} as any));
      const rows: Array<{ location?: string; checkin?: string; checkout?: string; email?: string; date?: string }>
        = Array.isArray(data?.rows) ? data.rows : [];
      const eq = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
      const me = identity ? identity.toLowerCase() : undefined;
      // Only enforce if we can identify the current user
      const conflicts = me
        ? rows.filter((r) => (
            String(r.email || '').toLowerCase() === me &&
            eq(r.location || (r as any).checkinLocation, name) &&
            !r.checkout
          ))
        : [];
      if (conflicts.length > 0) {
        // Set a non-blocking warning and optionally prompt to open existing task
        setSameLocationWarning('ตำแหน่งนี้มีงานที่ยังไม่ check-out กรุณาทำให้เสร็จก่อน');
        try {
          const row = conflicts[0];
          const date = row.date || todayUtcDate();
          const loc = row.location || '';
          const ci = row.checkin || '';
          const keyRaw = `${identity || ''}|${date}|${loc}|${ci}`;
          const encoded = typeof btoa === 'function'
            ? encodeURIComponent(btoa(unescape(encodeURIComponent(keyRaw))))
            : '';
          if (encoded) setSameLocationExistingId(encoded);
          if (encoded) {
            const go = window.confirm('มีงานที่ยังไม่ check-out สำหรับตำแหน่งนี้ เปิดงานเดิมหรือไม่?');
            if (go) router.push(`/checkin/${encoded}`);
          }
        } catch {}
        // Do not block creation; return true
        return true;
      }
      setSameLocationExistingId(null);
      return true;
    } catch {
      return true;
    }
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
        setCheckinCaptureAt(Date.now());
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
              setCheckinCaptureAt(Date.now());
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

  async function selectPlace(p: { name: string; address?: string; lat?: number; lon?: number }) {
    if (p.lat != null && p.lon != null) {
      const coord = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
      setGps(coord);
      setCheckinAddress(p.address || "");
      setCheckinCaptureAt(Date.now());
    }
    setLocationName(p.name);
    setPickerOpen(false);
    await validateLocationMatch(p.name);
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
    setPhotoFile(f);
    const ms = typeof f.lastModified === 'number' && f.lastModified > 0 ? f.lastModified : Date.now();
    setCheckinPhotoTakenAt(ms);
    try {
      const iso = new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
      setCheckinTime(iso);
    } catch {}
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
    const ms = typeof f.lastModified === 'number' && f.lastModified > 0 ? f.lastModified : Date.now();
    setCheckoutPhotoTakenAt(ms);
    try {
      const iso = new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
      setCheckoutTime(iso);
    } catch {}
  }

  async function onSubmitCheckin() {
    try {
      // Fast guard against rapid double-clicks
      if (checkinLockRef.current) return;
      checkinLockRef.current = true;
      setIsSubmitting(true);
      if (!(await validateLocationMatch())) {
        return;
      }
      // Non-blocking reminder for same-location ongoing task
      await validateNoOngoingSameLocation();
      if (checkinCaptureAt != null && Date.now() - checkinCaptureAt > 5 * 60 * 1000) {
        alert("submit check-in timeout");
        return;
      }
      if (!locationName.trim()) {
        alert("Please enter a location name");
        return;
      }
      if (!photoFile) {
        alert("Please attach a check-in photo");
        return;
      }
      let uploadedUrl: string | null = null;
      if (photoFile) uploadedUrl = await uploadPhoto(photoFile);
      // Use photo capture time if available; otherwise current time
      const ms = checkinPhotoTakenAt ?? Date.now();
      const iso = new Date(ms - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCheckinTime(iso);
      const resp = await submitCheckin({
        checkin: iso,
        locationName,
        gps,
        checkinAddress,
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
      checkinLockRef.current = false;
    }
  }

  function onCheckout() {
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCheckoutTime(iso);
    setCheckoutRemark("");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lon = pos.coords.longitude.toFixed(6);
          const coord = `${lat}, ${lon}`;
          setCheckoutGps(coord);
          const addr = await reverseGeocode(parseFloat(lat), parseFloat(lon));
          setCheckoutAddress(addr || "");
          const a = toLatLonPair(gps);
          const b = toLatLonPair(coord);
          if (a && b) {
            const d = distanceKm(a, b);
            const threshold = maxDistanceKm();
            if (d > threshold) {
              const meters = Math.round(d * 1000);
              setCheckoutRemark(`Checkout location differs by ~${meters} m (>${threshold} km)`);
              setCheckoutOutOfArea(true);
              alert("จุด check-out อยู่นอกพื้นที่ check-in");
            } else {
              setCheckoutOutOfArea(false);
            }
          }
        },
        () => {
          // ignore error; user can still submit manually
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    }
  }

  function retryCheckoutGps() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        const coord = `${lat}, ${lon}`;
        setCheckoutGps(coord);
        const addr = await reverseGeocode(parseFloat(lat), parseFloat(lon));
        setCheckoutAddress(addr || "");
        const a = toLatLonPair(gps);
        const b = toLatLonPair(coord);
        if (a && b) {
          const d = distanceKm(a, b);
          const threshold = maxDistanceKm();
          if (d > threshold) {
            const meters = Math.round(d * 1000);
            setCheckoutRemark(`Checkout location differs by ~${meters} m (>${threshold} km)`);
            setCheckoutOutOfArea(true);
          } else {
            setCheckoutRemark("");
            setCheckoutOutOfArea(false);
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function onSubmitCheckout() {
    try {
      // Fast guard against rapid double-clicks
      if (checkoutLockRef.current) return;
      checkoutLockRef.current = true;
      setIsSubmitting(true);
      if (!locationName.trim()) {
        alert("Please enter a location name");
        return;
      }
      if (!checkoutPhotoFile) {
        alert("Please attach a checkout photo");
        return;
      }
      // Validate distance before submit
      const a = toLatLonPair(gps);
      const b = toLatLonPair(checkoutGps);
      if (a && b) {
        const d = distanceKm(a, b);
        const threshold = maxDistanceKm();
        if (d > threshold) {
          setCheckoutOutOfArea(true);
          alert("จุด check-out อยู่นอกพื้นที่ check-in");
          return;
        }
      }
      let uploadedUrl: string | null = null;
      if (checkoutPhotoFile) uploadedUrl = await uploadPhoto(checkoutPhotoFile);
      const resp = await submitCheckout({
        checkout: (() => { const ms = checkoutPhotoTakenAt ?? Date.now(); return new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16); })(),
        checkoutGps,
        checkoutAddress,
        checkoutPhotoUrl: uploadedUrl,
        locationName,
        checkoutRemark,
        problemDetail,
        problem: problemDetail,
        jobRemark,
        remark: jobRemark,
      });
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `Saved (${st})` : "Saved");
      setSubmittedCheckout(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
      checkoutLockRef.current = false;
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
          <div className="text-sm sm:text-base font-semibold">Check-in Time (auto)</div>
          <Input
            type="datetime-local"
            value={checkinTime}
            readOnly
            className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
            disabled
          />
        </div>

        <div className="mt-4">
          <div className="text-sm sm:text-base font-semibold">Location</div>
          <div className="mt-2">
            <Input
              value={locationName}
              onChange={(e) => { setLocationName(e.target.value); if (locationError) setLocationError(""); if (sameLocationWarning) setSameLocationWarning(""); if (sameLocationExistingId) setSameLocationExistingId(null); }}
              placeholder="Enter or pick a place"
              className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
              disabled={isSubmitting || submittedCheckin}
              onFocus={() => { if (suggestions.length > 0) setSuggestOpen(true); }}
              onBlur={async () => {
                setTimeout(() => setSuggestOpen(false), 120);
                if (locationName.trim()) {
                  const ok = await validateLocationMatch();
                  if (ok) await validateNoOngoingSameLocation();
                }
              }}
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
                      onClick={async () => {
                        setLocationName(p.name);
                        if (p.lat != null && p.lon != null) {
                          const coord = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
                          setGps(coord);
                          setCheckinAddress(p.address || '');
                        }
                        setSuggestOpen(false);
                        const ok = await validateLocationMatch(p.name);
                        if (ok) await validateNoOngoingSameLocation(p.name);
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
            {locationError ? (
              <div className="mt-1 text-xs text-red-700">{locationError}</div>
            ) : null}
            {sameLocationWarning ? (
              <div className="mt-1 text-xs text-red-700 flex items-center gap-2">
                <span>{sameLocationWarning}</span>
                {sameLocationExistingId ? (
                  <Link
                    href={`/checkin/${sameLocationExistingId}`}
                    className="underline text-red-800 hover:text-red-900"
                    title="เปิดงานเดิม"
                  >
                    เปิดงานเดิม
                  </Link>
                ) : null}
              </div>
            ) : null}
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
          <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4 min-h-[100px]">
            <div className="text-sm sm:text-base font-semibold">
              {locationName || "— No place selected"}
            </div>
            {showDetails && (
              <div className="mt-2">
                <div className="text-xs sm:text-sm break-words" title={gps || undefined}>GPS: {gps || "—"}</div>
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

        {/* Location Detail */}
        <div className="mt-5">
          <div className="text-sm sm:text-base font-semibold">Location Detail</div>
          <Input
            placeholder="Location detail (local name)"
            value={jobDetail}
            onChange={(e) => setJobDetail(e.target.value)}
            className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
            disabled={isSubmitting || submittedCheckin}
          />
        </div>

        {/* Take a picture */}
        <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
          <span className="text-sm sm:text-base">ถ่ายรูป</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting || submittedCheckin}
            title="เปิดกล้อง"
          >
            📷 ถ่ายรูป
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*;capture=camera"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
            disabled={isSubmitting || submittedCheckin}
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
        {!photoFile && !isSubmitting && !submittedCheckin ? (
          <div className="mt-1 text-xs text-red-700">Check-in photo is required</div>
        ) : null}

        {/* Action buttons */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={onSubmitCheckin}
            disabled={!locationName.trim() || !photoFile || isSubmitting || isCheckinExpired() || !!locationError}
            className="w-full rounded-full bg-[#BFD9C8] px-6 text-gray-900 hover:bg-[#b3d0bf] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
            title={!locationName.trim() ? "Please enter a location name" : !photoFile ? "Please attach a check-in photo" : isCheckinExpired() ? "submit check-in timeout" : locationError ? locationError : undefined}
          >
            Submit Check-in
          </Button>
          {submittedCheckin ? (
            <Button
              onClick={onCheckout}
              className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
            >
              Check-out
            </Button>
          ) : null}
        </div>

        {/* Checkout time */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="text-sm sm:text-base font-semibold">Check-out Time (auto)</div>
          <Input
            type="datetime-local"
            value={checkoutTime}
            readOnly
            className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11 w-full sm:w-[260px]"
            disabled
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
                {checkoutOutOfArea ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="rounded border border-red-300 bg-red-100 px-3 py-1 text-xs sm:text-sm text-red-800">
                      จุด check-out อยู่นอกพื้นที่ check-in
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 rounded-full border-black/20 bg-white px-2 text-xs"
                      onClick={retryCheckoutGps}
                    >
                      Try again
                    </Button>
                  </div>
                ) : null}
                {checkoutRemark ? (
                  <div className="mt-2 text-xs text-red-700">{checkoutRemark}</div>
                ) : null}
              </div>
            </div>

            {/* Checkout picture */}
            <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
              <span className="text-sm sm:text-base">ถ่ายรูป</span>
              <button
                type="button"
                onClick={() => checkoutFileRef.current?.click()}
                className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="เปิดกล้อง"
                disabled={isSubmitting || submittedCheckout}
              >
                📷 ถ่ายรูป
              </button>
              <input
                ref={checkoutFileRef}
                type="file"
                accept="image/*;capture=camera"
                capture="environment"
                className="hidden"
                onChange={onPickCheckoutPhoto}
                disabled={isSubmitting || submittedCheckout}
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
            {!checkoutPhotoFile && !isSubmitting && !submittedCheckout ? (
              <div className="mt-1 text-xs text-red-700">Checkout photo is required</div>
            ) : null}

            {/* Problem and Remark inputs */}
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-sm sm:text-base font-semibold">ปัญหาที่พบเจอ</div>
                <Input
                  placeholder="รายละเอียดปัญหาในการทำงาน (ถ้ามี)"
                  value={problemDetail}
                  onChange={(e) => setProblemDetail(e.target.value)}
                  className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
                  disabled={isSubmitting || submittedCheckout}
                />
              </div>
              <div>
                <div className="text-sm sm:text-base font-semibold">หมายเหตุ</div>
                <Input
                  placeholder="เหตุผลเช็คเอาท์ช้า/เร็วกว่าปกติ (ถ้ามี)"
                  value={jobRemark}
                  onChange={(e) => setJobRemark(e.target.value)}
                  className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
                  disabled={isSubmitting || submittedCheckout}
                />
              </div>
            </div>

            {/* Submit Checkout */}
            <div className="mt-4">
              <Button
                onClick={onSubmitCheckout}
                disabled={!locationName.trim() || !checkoutPhotoFile || checkoutOutOfArea || isSubmitting}
                className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
                title={!locationName.trim() ? "Please enter a location name" : !checkoutPhotoFile ? "Please take a checkout selfie" : checkoutOutOfArea ? "จุด check-out อยู่นอกพื้นที่ check-in" : undefined}
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











