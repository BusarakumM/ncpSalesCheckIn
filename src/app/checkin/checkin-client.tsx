"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import LogoBadge from "@/components/LogoBadge";

type Task = {
  id: number;
  location: string;
  status: "In Progress" | "Completed" | "Not start yet";
  date: string; // yyyy-mm-dd
};

const MOCK: Task[] = [
  { id: 1, location: "Location", status: "In Progress",   date: "2025-06-16" },
  { id: 2, location: "Location", status: "Completed",     date: "2025-06-16" },
  { id: 3, location: "Location", status: "Not start yet", date: "2025-06-16" },
];

export default function CheckinClient({ homeHref }: { homeHref: string }) {
  const [qDate, setQDate] = useState("");
  const filtered = useMemo(
    () => (!qDate ? MOCK : MOCK.filter((t) => t.date === qDate)),
    [qDate]
  );

  function statusStyles(s: Task["status"]) {
    if (s === "Completed") return "bg-[#6EC3A1] text-white px-2 py-0.5 rounded text-xs sm:text-sm";
    if (s === "In Progress") return "text-gray-800";
    return "text-gray-600 italic";
  }

  function rowBg(s: Task["status"]) {
    if (s === "Completed") return "bg-[#8ac7a9] text-white"; // green highlight like mock
    return "bg-white";
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            Check-in Check-out
          </h1>
        </div>

        {/* Date + New */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm">Date</span>
            <Input
              type="date"
              value={qDate}
              onChange={(e) => setQDate(e.target.value)}
              className="h-9 sm:h-8 w-full sm:w-[190px] rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>
          <div className="flex sm:block">
            <Link
              href="/checkin/new"
              className="ml-auto text-base sm:text-lg font-semibold text-[#6EBF8B] hover:opacity-90"
              title="Create new task"
            >
              + New
            </Link>
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-2xl px-4 py-3 shadow-sm border border-black/10 ${rowBg(t.status)}`}
            >
              {/* Mobile layout (stacked) */}
              <div className="flex sm:hidden items-start gap-3">
                <div className="min-w-[32px] h-8 rounded-md bg-white/70 text-center leading-8 font-semibold text-gray-800">
                  {t.id}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-base">{t.location}</div>
                  <div className={`mt-1 ${statusStyles(t.status)}`}>{t.status}</div>
                </div>
                <Link
                  href={`/checkin/${t.id}`}
                  className="self-center inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 hover:bg-gray-50 text-xs font-bold"
                  title="Open task"
                >
                  CHECK
                </Link>
              </div>
              {/* Tablet+ layout (grid) */}
              <div className="hidden sm:grid grid-cols-[36px_1fr_auto] items-center gap-4">
                <div className="text-center font-semibold">{t.id}</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-lg">{t.location}</div>
                    <div className={`${statusStyles(t.status)}`}>{t.status}</div>
                  </div>
                </div>
                <Link
                  href={`/checkin/${t.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 hover:bg-gray-50"
                  title="Open task"
                >
                  <span className="text-xs font-bold">CHECK</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom-right logo */}
        <div className="mt-10 flex justify-end">
          <LogoBadge size={56} className="scale-[0.95] sm:scale-100" />
        </div>
      </div>
    </div>
  );
}
