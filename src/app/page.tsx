"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/sign-in");
    }, 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F7F4EA] flex flex-col items-center justify-center">
      <div className="relative flex flex-col items-center">
        {/* Scene wrapper (responsive) */}
        <div className="relative" style={{ width: "min(80vw, 360px)", height: "min(80vw, 360px)" }}>
          {/* Earth (tries brand png, falls back to built-in globe.svg) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/locatiomearth.png"
            alt="Earth"
            className="absolute inset-0 w-full h-full object-contain earth-animate select-none pointer-events-none"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/globe.svg"; }}
          />
          {/* Walker orbiting inside the earth area */}
          <div className="walker-orbit">
            {/* Holder placed at the orbit edge; parent rotates, child counter-rotates to keep orientation */}
            <div style={{ position: "absolute", right: "8%", top: "50%", transform: "translateY(-50%)" }}>
              <div className="walker-counter">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/travelerperson.png"
                  alt="Traveler"
                  className="walker-img drop-shadow-md select-none pointer-events-none"
                  style={{ width: "24%", height: "auto" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/brand/salescheckin.png"; }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 text-xl sm:text-2xl font-extrabold text-gray-900 tracking-wide">
          NCP Sales Support
        </div>
        <div className="text-sm text-gray-700">Loading...</div>
      </div>
    </div>
  );
}
