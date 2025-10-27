"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/utils";

type Row = {
  date: string;        // yyyy-mm-dd
  checkin: string;     // HH.mm
  checkout: string;    // HH.mm or ""
  imageIn?: string;
  imageOut?: string;
  status?: string;
  remark?: string;
  name: string;
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  checkinAddress?: string;
  checkoutAddress?: string;
  distanceKm?: number;
};

const DATA: Row[] = [];

export default function TimeAttendanceClient({ homeHref }: { homeHref: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qName, setQName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [qDistrict, setQDistrict] = useState("");
  const MAX_KM = parseFloat(process.env.NEXT_PUBLIC_MAX_DISTANCE_KM || "");
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=160x120&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }

  async function load() {
    const res = await fetch("/api/pa/time-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, name: qName, district: qDistrict })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load time-attendance");
    setRows(data.rows as Row[]);
  }

  useEffect(() => { load().catch(() => {}); }, []);
  function exportCsv() {
    const header = [
      "Date/Time","Check-in time","Check-out time","Check-in GPS","Check-out GPS","Distance (km)","Image Check-in","Image check-out","Status/leave","Remark","Sales Support Name","District"
    ];
    const lines = rows.map((r) => [
      r.date, r.checkin || "-", r.checkout || "-", r.checkinGps || "", r.checkoutGps || "", (r.distanceKm != null ? r.distanceKm.toFixed(3) : ""), r.imageIn || "", r.imageOut || "", r.status || "", r.remark || "", r.name, r.district || "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "time-attendance.csv";
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
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            Time Attendance report
          </h1>
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium">Filter : Date</div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium">Filter : Sales Support Name</div>
              <Input
                placeholder="Search by name"
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <div className="text-sm font-medium">Filter : District</div>
              <Input
                placeholder="District"
                value={qDistrict}
                onChange={(e) => setQDistrict(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="mt-2 flex justify-center">
            <Button
              onClick={load}
              className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10"
            >
              OK
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto overflow-y-auto max-h-[240px] bg-white border border-black/20 rounded-md">
            {/* keep enough width so columns don't squish on phones */}
            <Table className="min-w-[900px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">Date/Time</TableHead>
                  <TableHead className="min-w-[120px]">Check-in</TableHead>
                  <TableHead className="min-w-[120px]">Check-out</TableHead>
                  <TableHead className="min-w-[160px]">Check-in GPS</TableHead>
                  <TableHead className="min-w-[160px]">Check-out GPS</TableHead>
                  <TableHead className="min-w-[120px]">Distance (km)</TableHead>
                  <TableHead className="min-w-[160px]">Image Check-in</TableHead>
                  <TableHead className="min-w-[160px]">Image check-out</TableHead>
                  <TableHead className="min-w-[140px]">Status/leave</TableHead>
                  <TableHead className="min-w-[200px]">Remark</TableHead>
                  <TableHead className="min-w-[140px]">District</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No data for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell title={formatDateDisplay(r.date) === "–" ? "Missing or invalid date" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                      <TableCell title={r.checkinGps || undefined}>{r.checkin || "-"}</TableCell>
                      <TableCell title={r.checkoutGps || undefined}>{r.checkout || "-"}</TableCell>
                      <TableCell>
                        {r.checkinGps ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkinGps)}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                            {r.checkinGps}
                          </a>
                         ) : ("")}
                        {r.checkinAddress ? (
                          <div className="mt-1 text-xs text-gray-700" title={r.checkinAddress}>{r.checkinAddress}</div>
                        ) : null}
                        {r.checkinGps && GMAPS_KEY ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mapUrl(r.checkinGps)} alt="check-in map" className="mt-1 rounded border border-black/10" />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {r.checkoutGps ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkoutGps)}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                            {r.checkoutGps}
                          </a>
                         ) : ("")}
                        {r.checkoutAddress ? (
                          <div className="mt-1 text-xs text-gray-700" title={r.checkoutAddress}>{r.checkoutAddress}</div>
                        ) : null}
                        {r.checkoutGps && GMAPS_KEY ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mapUrl(r.checkoutGps)} alt="check-out map" className="mt-1 rounded border border-black/10" />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {r.distanceKm != null ? (
                          <span className={MAX_KM && r.distanceKm > MAX_KM ? "text-red-700 font-semibold" : ""}>
                            {r.distanceKm.toFixed(3)}
                            {MAX_KM && r.distanceKm > MAX_KM ? " !" : ""}
                          </span>
                        ) : ""}
                      </TableCell>
                      <TableCell>
                        {r.imageIn ? (
                          <a href={r.imageIn} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.imageIn} alt="check-in" className="mt-1 h-20 w-auto rounded border border-black/10" />
                          </a>
                        ) : ("")}
                      </TableCell>
                      <TableCell>
                        {r.imageOut ? (
                          <a href={r.imageOut} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.imageOut} alt="check-out" className="mt-1 h-20 w-auto rounded border border-black/10" />
                          </a>
                        ) : ("")}
                      </TableCell>
                      <TableCell>{r.status || ""}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{r.remark || ""}</TableCell>
                      <TableCell>{r.district || ""}</TableCell>
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









