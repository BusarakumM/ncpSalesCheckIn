"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function NewTaskPage() {
  const [checkinTime, setCheckinTime] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [gps, setGps] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDetail, setJobDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Prefill current datetime as check-in time
  useEffect(() => {
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16); // yyyy-MM-ddTHH:mm
    setCheckinTime(iso);
  }, []);

  function getGPS() {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setGps(`${lat}, ${lon}`);
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
    // TODO: POST to /api/checkin
    alert("Saved (mock).");
  }

  function onCheckout() {
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCheckoutTime(iso);
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto max-w-md px-4 pt-4 pb-10">
        {/* Header with back icon */}
        <div className="mb-2 flex items-center gap-2">
          <Link
            href="/checkin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Back"
          >
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-2xl font-extrabold">Task No.</h1>
        </div>

        {/* Check-in time */}
        <div className="mt-2 text-sm font-semibold">Check-in Time :</div>
        <div className="mt-1">
          <Input
            type="datetime-local"
            value={checkinTime}
            onChange={(e) => setCheckinTime(e.target.value)}
            className="rounded-full border-black/10 bg-[#D8CBAF]/60"
          />
        </div>

        {/* Location Name */}
        <div className="mt-4 text-sm font-semibold">Location Name</div>
        <Input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60"
        />

        {/* GPS */}
        <div className="mt-4 text-sm font-semibold">GPS</div>
        <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 min-h-[140px]">
          <div className="text-sm">{gps || "—"}</div>
          <div className="mt-3">
            <Button
              onClick={getGPS}
              variant="outline"
              className="rounded-full border-black/20 bg-white hover:bg-gray-50"
            >
              Get GPS
            </Button>
          </div>
        </div>

        {/* Job Detail */}
        <div className="mt-5 text-sm font-semibold">Job Detail</div>
        <Input
          placeholder="Title / short description"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60"
        />
        <Textarea
          placeholder="More details…"
          value={jobDetail}
          onChange={(e) => setJobDetail(e.target.value)}
          className="mt-3 min-h-[180px] border-black/10 bg-[#BFD9C8]"
        />

        {/* Take a picture */}
        <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
          <span>Take a picture</span>{" "}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-50"
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

        {/* Photo preview area (matches big mint box in mock) */}
        <div className="mt-3 min-h-[200px] overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="p-4 text-sm text-gray-700">No photo</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={onSave}
            className="rounded-full bg-[#BFD9C8] px-6 text-gray-900 hover:bg-[#b3d0bf] border border-black/20"
          >
            Save
          </Button>
          <Button
            onClick={onCheckout}
            className="rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
          >
            Check-out
          </Button>
        </div>

        {/* Checkout time */}
        <div className="mt-4 text-center text-sm font-semibold">
          Check-out Time :
          <Input
            type="datetime-local"
            value={checkoutTime}
            onChange={(e) => setCheckoutTime(e.target.value)}
            className="ml-2 inline-block w-[220px] rounded-full border-black/10 bg-[#D8CBAF]/60"
          />
        </div>
      </div>
    </div>
  );
}
