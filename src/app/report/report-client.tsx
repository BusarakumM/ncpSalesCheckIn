"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = {
  date: string;        // yyyy-mm-dd
  checkin: string;     // HH.mm
  checkout: string;    // HH.mm or ""
  location: string;
  detail: string;
  image: string;       // image url or filename
  status: "completed" | "incomplete" | "ongoing";
};

const DATA: Row[] = [
  { date: "2025-06-16", checkin: "10.00", checkout: "11.00", location: "โลตัสบางกะปิ", detail: "เยี่ยมร้าน", image: "photo-1001.jpg", status: "completed" },
  { date: "2025-06-16", checkin: "11.30", checkout: "13.21", location: "เซเว่น บางรักพลี", detail: "เยี่ยมร้าน", image: "photo-1002.jpg", status: "incomplete" },
  { date: "2025-06-16", checkin: "13.24", checkout: "",      location: "แม็คโคร บางคูวัด", detail: "เยี่ยมร้าน", image: "photo-1003.jpg", status: "ongoing" },
];

export default function ReportClient({ homeHref }: { homeHref: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [submitted, setSubmitted] = useState<{ from?: string; to?: string }>({});

  const filtered = useMemo(() => {
    const f = submitted.from ? new Date(submitted.from) : null;
    const t = submitted.to ? new Date(submitted.to) : null;
    return DATA.filter((r) => {
      const d = new Date(r.date);
      if (f && d < f) return false;
      if (t && d > t) return false;
      return true;
    });
  }, [submitted]);

  function onOk() {
    setSubmitted({ from, to });
  }

  function statusClass(s: Row["status"]) {
    if (s === "completed") return "bg-[#6EC3A1] text-white";
    if (s === "incomplete") return "bg-[#E9A0A0] text-black";
    return "bg-[#E7D6B9] text-black";
  }

  function exportCsv() {
    const header = ["Date/Time", "Check-in time", "Check-out time", "Location name", "Activity detail", "Image uri", "Status"];
    const lines = filtered.map((r) => [
      r.date, r.checkin, r.checkout || "-", r.location, r.detail, r.image, r.status,
    ]);
    const csv = [header, ...lines]
      .map(row => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">Report</h1>
        </div>

        {/* Filter */}
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Filter : Date</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" />
            </div>
            <div>
              <Label className="mb-1 block">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" />
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <Button
              onClick={onOk}
              className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10"
            >
              OK
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto bg-white border border-black/20 rounded-md">
            <Table className="min-w-[820px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">Date/Time</TableHead>
                  <TableHead className="min-w-[120px]">Check-in</TableHead>
                  <TableHead className="min-w-[120px]">Check-out</TableHead>
                  <TableHead className="min-w-[160px]">Location name</TableHead>
                  <TableHead className="min-w-[180px]">Activity detail</TableHead>
                  <TableHead className="min-w-[160px]">Image uri</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No data for the selected range
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {new Date(r.date).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{r.checkin}</TableCell>
                      <TableCell>{r.checkout || "-"}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell>{r.detail}</TableCell>
                      <TableCell className="truncate">{r.image}</TableCell>
                      <TableCell>
                        <span className={`inline-flex w-full justify-center rounded px-2 py-1 text-sm font-medium ${statusClass(r.status)}`}>
                          {r.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Export */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700 text-center sm:text-left">
            Export file <br className="sm:hidden" /> .xlsx
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/30 bg-white hover:bg-gray-50 self-center sm:self-auto"
            title="Export"
          >
            ➜
          </button>
        </div>
      </div>
    </div>
  );
}
