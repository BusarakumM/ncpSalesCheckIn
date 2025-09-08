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
    () => (!qDate ? MOCK : MOCK.filter(t => t.date === qDate)),
    [qDate]
  );

  function statusStyles(s: Task["status"]) {
    if (s === "Completed") return "bg-[#6EC3A1] text-white";
    if (s === "In Progress") return "text-gray-800";
    return "text-gray-600 italic";
  }

  function rowBg(s: Task["status"]) {
    if (s === "Completed") return "bg-[#8ac7a9] text-white"; // green highlight like mock
    return "bg-white";
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto max-w-md px-4 pt-4 pb-10">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-2xl font-extrabold">Check-in Check-out</h1>
        </div>

        {/* Date + New */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">Date</span>
            <Input
              type="date"
              value={qDate}
              onChange={(e) => setQDate(e.target.value)}
              className="h-8 w-[170px] rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>
          <Link
            href="/checkin/new"
            className="text-lg font-semibold text-[#6EBF8B] hover:opacity-90"
            title="Create new task"
          >
            + New
          </Link>
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-2xl px-4 py-3 shadow-sm border border-black/10 ${rowBg(t.status)}`}
            >
              <div className="text-center font-semibold">{t.id}</div>
              <div>
                <div className="font-medium">{t.location}</div>
                <div className={`text-sm ${statusStyles(t.status)}`}>{t.status}</div>
              </div>

              {/* Check-in icon button: go to edit/view */}
              <Link
                href={`/checkin/${t.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 hover:bg-gray-50"
                title="Open task"
              >
                <span className="text-xs font-bold">CHECK</span>
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom-right logo placeholder */}
        <div className="mt-12 flex justify-end">
          <LogoBadge size={56} />
        </div>
      </div>
    </div>
  );
}
