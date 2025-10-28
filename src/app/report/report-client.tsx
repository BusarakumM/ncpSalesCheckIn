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
  checkin?: string;
  checkout?: string;
  location: string;
  detail?: string;
  name?: string;
  imageIn?: string;
  imageOut?: string;
  status: "completed" | "incomplete" | "ongoing";
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  distanceKm?: number;
  remark?: string;
};

const DATA: Row[] = [];

export default function ReportClient({ homeHref, role, email }: { homeHref: string; role?: "SUPERVISOR" | string; email?: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [location, setLocation] = useState("");
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [district, setDistrict] = useState("");
  const MAX_KM = parseFloat(process.env.NEXT_PUBLIC_MAX_DISTANCE_KM || "");
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=160x120&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }
  function statusClass(s: Row["status"]) {
    if (s === "completed") return "bg-[#6EC3A1] text-white";
    if (s === "incomplete") return "bg-[#E9A0A0] text-black";
    return "bg-[#E7D6B9] text-black";
  }

  async function load(override?: { from?: string; to?: string; location?: string; district?: string }) {
    const sendFrom = override?.from ?? from;
    const sendTo = override?.to ?? to;
    const sendLocation = override?.location ?? location;
    const sendDistrict = override?.district ?? district;
    const res = await fetch("/api/pa/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: sendFrom, to: sendTo, location: sendLocation, district: sendDistrict }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load report");
    const mapped: Row[] = (data.rows || []).map((r: any) => ({
      date: r.date,
      checkin: r.checkin,
      checkout: r.checkout,
      location: r.location,
      detail: r.detail,
      name: r.name,
      imageIn: r.imageIn || "",
      imageOut: r.imageOut || r.image || "",
      status: r.status,
      district: r.district,
      checkinGps: r.checkinGps,
      checkoutGps: r.checkoutGps,
      distanceKm: r.distanceKm,
      remark: (() => {
        const d = typeof r.distanceKm === 'number' ? r.distanceKm : null;
        if (d != null && isFinite(d) && MAX_KM && d > MAX_KM) {
          return "Checkout location differs from check-in";
        }
        return "";
      })(),
    }));
    setRows(mapped);
    // Build location dropdown (for non-supervisor: only from own rows)
    try {
      const uniq = Array.from(new Set(mapped.map((r) => r.location).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
      setAllLocations(uniq);
    } catch {}
  }

  function clearFilters() {
    setFrom("");
    setTo("");
    setLocation("");
    setDistrict("");
    load({ from: "", to: "", location: "", district: "" }).catch(() => {});
  }

  useEffect(() => { load().catch(() => {}); }, []);


  function exportCsv() {
    const header = ["Date/Time", "Check-in time", "Check-out time", "Location name", "Activity detail", "Sales Support Name", "District", "Check-in GPS", "Check-out GPS", "Distance (km)", "Image Check-in", "Image check-out", "Remark", "Status"];
    const lines = rows.map((r) => [
      r.date, r.checkin, r.checkout || "-", r.location, r.detail, r.name || "", r.district || "", r.checkinGps || "", r.checkoutGps || "", r.distanceKm != null ? r.distanceKm.toFixed(3) : "", r.imageIn || "", r.imageOut || "", r.remark || "", r.status,
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="mb-1 block">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" />
          </div>
          <div>
            <Label className="mb-1 block">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" />
          </div>
          {role === "SUPERVISOR" ? (
            <div>
              <Label className="mb-1 block">District</Label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" className="bg-white" />
            </div>
          ) : (
            <div>
              <Label className="mb-1 block">Location</Label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white w-full h-9 rounded-md border px-2 text-sm">
                <option value="">All</option>
                {allLocations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}
        </div>
          <div className="mt-3 flex justify-center gap-3">
            <Button
              onClick={() => load().catch(() => {})}
              className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10"
            >
              OK
            </Button>
            <Button
              onClick={clearFilters}
              className="rounded-full bg-white text-gray-900 hover:bg-gray-50 border border-black/20 px-6 sm:px-10"
            >
              Clear filters
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto overflow-y-auto max-h-[240px] bg-white border border-black/20 rounded-md">
            <Table className="min-w-[1120px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">Date/Time</TableHead>
                  <TableHead className="min-w-[120px]">Check-in</TableHead>
                  <TableHead className="min-w-[120px]">Check-out</TableHead>
                  <TableHead className="min-w-[160px]">Location name</TableHead>
                  <TableHead className="min-w-[180px]">Activity detail</TableHead>
                  <TableHead className="min-w-[180px]">Sales support name</TableHead>
                  <TableHead className="min-w-[140px]">District</TableHead>
                  <TableHead className="min-w-[180px]">In GPS</TableHead>
                  <TableHead className="min-w-[180px]">Out GPS</TableHead>
                  <TableHead className="min-w-[120px]">Distance (km)</TableHead>
                  <TableHead className="min-w-[160px]">Image Check-in</TableHead>
                  <TableHead className="min-w-[160px]">Image check-out</TableHead>
                  <TableHead className="min-w-[220px]">Remark</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-gray-500">
                      No data for the selected range
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell title={formatDateDisplay(r.date) === "–" ? "Missing or invalid date" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                      <TableCell>{r.checkin}</TableCell>
                      <TableCell>{r.checkout || "-"}</TableCell>
                      <TableCell title={[r.checkinGps, r.checkoutGps].filter(Boolean).join(' | ') || undefined}>{r.location}</TableCell>
                      <TableCell>{r.detail}</TableCell>
                      <TableCell>{r.name || ""}</TableCell>
                      <TableCell>{r.district || ""}</TableCell>
                      <TableCell>
                        {r.checkinGps ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkinGps)}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                            {r.checkinGps}
                          </a>
                        ) : ("")}
                        {(r as any).checkinAddress ? (
                          <div className="mt-1 text-xs text-gray-700" title={(r as any).checkinAddress}>{(r as any).checkinAddress}</div>
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
                        {(r as any).checkoutAddress ? (
                          <div className="mt-1 text-xs text-gray-700" title={(r as any).checkoutAddress}>{(r as any).checkoutAddress}</div>
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
                      <TableCell className="whitespace-pre-wrap">{r.remark || ""}</TableCell>
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









