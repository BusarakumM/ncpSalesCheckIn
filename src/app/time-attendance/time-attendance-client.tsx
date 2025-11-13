"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/utils";

type Row = {
  date: string;
  group?: string;
  district?: string;
  employeeNo?: string;
  name: string;
  firstCheckin?: string;
  firstLocation?: string;
  firstImage?: string;
  firstGps?: string;
  firstAddress?: string;
  totalLocations: number;
  lastCheckout?: string;
  lastLocation?: string;
  lastCheckoutImage?: string;
  lastGps?: string;
  lastAddress?: string;
  leaveNote?: string;
};

const DATA: Row[] = [];

export default function TimeAttendanceClient({ homeHref }: { homeHref: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qName, setQName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [qDistrict, setQDistrict] = useState("");
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=200x140&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }

  function formatLatLon(gps?: string) {
    if (!gps) return "";
    const parts = gps.split(",");
    if (parts.length < 2) return gps;
    const lat = parts[0]?.trim();
    const lon = parts[1]?.trim();
    if (!lat || !lon) return gps;
    return `Lat: ${lat}, Lon: ${lon}`;
  }

  const renderLocationCell = (loc: { name?: string; address?: string; gps?: string }) => (
    <div className="space-y-1">
      <div className="font-medium">{loc.name || "-"}</div>
      {loc.address ? (
        <div className="text-xs text-gray-700 whitespace-pre-wrap">{loc.address}</div>
      ) : null}
      {formatLatLon(loc.gps) ? (
        <div className="text-xs text-gray-600">{formatLatLon(loc.gps)}</div>
      ) : null}
      {loc.gps && GMAPS_KEY ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapUrl(loc.gps)}
          alt="แผนที่สถานที่"
          className="mt-1 h-20 w-auto rounded border border-black/10"
        />
      ) : null}
    </div>
  );

  const summarizeLocation = (name?: string, gps?: string, address?: string) => {
    let value = name || "";
    if (gps) value += value ? ` (GPS: ${gps})` : `GPS: ${gps}`;
    if (address) value += value ? ` – ${address}` : address;
    return value;
  };

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
      "Date/Time",
      "Group",
      "District",
      "Employee No.",
      "Sales Support Name",
      "First check-in time",
      "First location",
      "First location GPS/Address",
      "Photo (first location)",
      "Total locations",
      "Last check-out time",
      "Last location",
      "Last location GPS/Address",
      "Photo (last location)",
      "Leave",
    ];
    const lines = rows.map((r) => [
      r.date,
      r.group || "",
      r.district || "",
      r.employeeNo || "",
      r.name || "",
      r.firstCheckin || "",
      r.firstLocation || "",
      summarizeLocation(r.firstLocation, r.firstGps, r.firstAddress),
      r.firstImage || "",
      r.totalLocations ?? 0,
      r.lastCheckout || "",
      r.lastLocation || "",
      summarizeLocation(r.lastLocation, r.lastGps, r.lastAddress),
      r.lastCheckoutImage || "",
      r.leaveNote || "",
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
          <div className="mb-2 flex justify-end">
            <Button onClick={exportCsv} variant="outline" className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2">
              Export
            </Button>
          </div>

          {/* Mobile stacked layout */}
          <div className="sm:hidden space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-black/20 bg-white px-4 py-3 text-center text-gray-500">
                No data for the selected filters
              </div>
            ) : (
              rows.map((r, i) => (
                <div key={i} className="rounded-2xl border border-black/20 bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{formatDateDisplay(r.date)}</span>
                    <span>{r.name || ""}</span>
                  </div>
                  <div className="text-sm">
                    <div>กลุ่ม: {r.group || "-"}</div>
                    <div>เขต: {r.district || "-"}</div>
                    <div>รหัสพนักงาน: {r.employeeNo || "-"}</div>
                  </div>
                  <div className="text-sm">
                    <div>เข้างาน: {r.firstCheckin || "-"}</div>
                    <div>แรกสุด: {r.firstLocation || "-"}</div>
                  </div>
                  <div className="text-sm">
                    <div>ออกงาน: {r.lastCheckout || "-"}</div>
                    <div>สุดท้าย: {r.lastLocation || "-"}</div>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>พิกัดแรก: {summarizeLocation(r.firstLocation, r.firstGps, r.firstAddress) || "-"}</div>
                    <div>พิกัดสุดท้าย: {summarizeLocation(r.lastLocation, r.lastGps, r.lastAddress) || "-"}</div>
                  </div>
                  <div className="text-sm font-semibold">
                    สถานะ/ลา: <span className="font-normal">{r.leaveNote || "-"}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
          <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-[65vh] lg:max-h-[70vh] bg-white border border-black/20 rounded-md">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="w-[9%]">Date/Time</TableHead>
                  <TableHead className="w-[8%]">Group</TableHead>
                  <TableHead className="w-[9%]">District</TableHead>
                  <TableHead className="w-[9%]">Employee No.</TableHead>
                  <TableHead className="w-[14%]">Sales Support Name</TableHead>
                  <TableHead className="w-[10%]">First check-in</TableHead>
                  <TableHead className="w-[15%]">First location</TableHead>
                  <TableHead className="w-[10%]">Photo (first)</TableHead>
                  <TableHead className="w-[6%]">Total locations</TableHead>
                  <TableHead className="w-[10%]">Last check-out</TableHead>
                  <TableHead className="w-[15%]">Last location</TableHead>
                  <TableHead className="w-[10%]">Photo (last)</TableHead>
                  <TableHead className="w-[15%]">Leave</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-gray-500">
                      No data for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell title={formatDateDisplay(r.date) === "–" ? "Missing or invalid date" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                      <TableCell>{r.group || ""}</TableCell>
                      <TableCell>{r.district || ""}</TableCell>
                      <TableCell>{r.employeeNo || ""}</TableCell>
                      <TableCell>{r.name || ""}</TableCell>
                      <TableCell>{r.firstCheckin || "-"}</TableCell>
                      <TableCell>{renderLocationCell({ name: r.firstLocation, address: r.firstAddress, gps: r.firstGps })}</TableCell>
                      <TableCell>
                        {r.firstImage ? (
                          <a href={r.firstImage} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.firstImage} alt="first location" className="mt-1 h-20 w-auto rounded border border-black/10" />
                          </a>
                        ) : (
                          ""
                        )}
                      </TableCell>
                      <TableCell>{r.totalLocations ?? 0}</TableCell>
                      <TableCell>{r.lastCheckout || "-"}</TableCell>
                      <TableCell>{renderLocationCell({ name: r.lastLocation, address: r.lastAddress, gps: r.lastGps })}</TableCell>
                      <TableCell>
                        {r.lastCheckoutImage ? (
                          <a href={r.lastCheckoutImage} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.lastCheckoutImage} alt="last location" className="mt-1 h-20 w-auto rounded border border-black/10" />
                          </a>
                        ) : (
                          ""
                        )}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap">{r.leaveNote || ""}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </div>

        {/* Export moved above table for consistency */}
      </div>
    </div>
  );
}




