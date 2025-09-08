"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [checkinTime, setCheckinTime] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [gps, setGps] = useState<string>("");
  const [jobDetail, setJobDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Prefill current datetime (local) as check-in time
  useEffect(() => {
    const now = new Date();
    const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16); // yyyy-MM-ddTHH:mm
    setCheckinTime(isoLocal);
  }, []);

  function captureGPS() {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
  }

  function onSave() {
    // TODO: POST to /api/checkin to persist
    alert("Saved (mock).");
  }

  function onCheckout() {
    const now = new Date();
    const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCheckoutTime(isoLocal);
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
            Task No. {id}
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
            />
          </div>
        </div>

        {/* Location Name */}
        <div className="mt-4">
          <div className="text-sm sm:text-base font-semibold">Location Name</div>
          <Input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
          />
        </div>

        {/* GPS */}
        <div className="mt-4">
          <div className="text-sm sm:text-base font-semibold">GPS</div>
          <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4">
            <div className="text-sm sm:text-base break-words">{gps || "—"}</div>
            <div className="mt-3">
              <Button
                onClick={captureGPS}
                variant="outline"
                className="rounded-full border-black/20 bg-white hover:bg-gray-50"
              >
                Get GPS
              </Button>
            </div>
          </div>
        </div>

        {/* Job Detail */}
        <div className="mt-5">
          <div className="text-sm sm:text-base font-semibold">Job Detail</div>
          <Textarea
            value={jobDetail}
            onChange={(e) => setJobDetail(e.target.value)}
            className="mt-2 min-h-[160px] sm:min-h-[180px] border-black/10 bg-[#BFD9C8]"
          />
        </div>

        {/* Take a picture bar */}
        <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
          <span className="text-sm sm:text-base">Take a picture</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50"
            title="Open camera"
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
          />
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
            onClick={onSave}
            className="w-full rounded-full bg-[#BFD9C8] px-6 text-gray-900 hover:bg-[#b3d0bf] border border-black/20"
          >
            Save
          </Button>
          <Button
            onClick={onCheckout}
            className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
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
          />
        </div>
      </div>
    </div>
  );
}
