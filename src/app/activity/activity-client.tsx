"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = {
  date: string;
  checkin?: string;
  checkout?: string;
  location: string;
  detail?: string;
  status: "completed" | "incomplete" | "ongoing";
  name?: string;
  email?: string;
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  distanceKm?: number;
};

const DATA: Row[] = [];

export default function ActivityClient({ homeHref }: { homeHref: string }) {
  const [qName, setQName] = useState("");
  const [qFrom, setQFrom] = useState("");
  const [qTo, setQTo] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [qDistrict, setQDistrict] = useState("");
  const MAX_KM = parseFloat(process.env.NEXT_PUBLIC_MAX_DISTANCE_KM || "");
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=160x120&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }

  async function fetchRows() {
    const payload: any = {};
    if (qName) payload.name = qName;
    if (qFrom) payload.from = qFrom;
    if (qTo) payload.to = qTo;
    if (qDistrict) payload.district = qDistrict;
    const res = await fetch('/api/pa/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load');
    setRows(data.rows as Row[]);
  }

  useEffect(() => { fetchRows().catch(() => {}); }, []);
  const filtered = useMemo(() => {
    return DATA.filter((r) => {
      const n = (r.name || "").toLowerCase();
      const e = (r.email || "").toLowerCase();
      const q = qName.toLowerCase();
      const nameMatch = !qName || n.includes(q) || e.includes(q);
      const fromOk = !qFrom || r.date >= qFrom;
      const toOk = !qTo || r.date <= qTo;
      return nameMatch && fromOk && toOk;
    });
  }, [qName, qFrom, qTo]);

  function rowBg(status: Row["status"]) {
    if (status === "completed") return "bg-[#6EC3A1] text-white"; // green
    if (status === "incomplete") return "bg-[#E9A0A0] text-black"; // red
    return "bg-[#E7D6B9] text-black"; // beige
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-8 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
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
            Sales Support Activity
          </h1>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Sales support name</Label>
            <Input
              placeholder="Name or e-mail"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              className="bg-white"
            />
          </div>
          <div>
            <Label>Date range</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={qFrom}
                onChange={(e) => setQFrom(e.target.value)}
                className="bg-white"
                placeholder="From"
              />
              <Input
                type="date"
                value={qTo}
                onChange={(e) => setQTo(e.target.value)}
                className="bg-white"
                placeholder="To"
              />
            </div>
          </div>
          <div>
            <Label>District</Label>
            <Input
              placeholder="District"
              value={qDistrict}
              onChange={(e) => setQDistrict(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <Button onClick={fetchRows} className="rounded-full bg-[#BFD9C8] text-gray-900 hover:bg-[#b3d0bf] border border-black/10 px-6 sm:px-10">Search</Button>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto overflow-y-auto max-h-[240px] bg-white border border-black/20 rounded-md">
            <Table className="min-w-[700px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#E0D4B9] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="min-w-[160px]">Location</TableHead>
                  <TableHead className="min-w-[160px]">Detail</TableHead>
                  <TableHead className="min-w-[140px]">District</TableHead>
                  <TableHead className="min-w-[180px]">In gps</TableHead>
                  <TableHead className="min-w-[180px]">Out gps</TableHead>
                  <TableHead className="min-w-[120px]">Distance (km)</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No results
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {new Date(r.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{r.checkin || "-"}</TableCell>
                      <TableCell>{r.checkout || "-"}</TableCell>
                      <TableCell title={[r.checkinGps, r.checkoutGps].filter(Boolean).join(' | ') || undefined}>{r.location}</TableCell>
                      <TableCell>{r.detail || ""}</TableCell>
                      <TableCell>{r.district || ""}</TableCell>
                      <TableCell>
                        {r.checkinGps ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkinGps)}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                            {r.checkinGps}
                          </a>
                        ) : ("")}
                        {/** address if present (added on server) */}
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
                        {r.checkoutGps ? (
                          r.distanceKm != null ? (
                            <span className={MAX_KM && r.distanceKm > MAX_KM ? "text-red-700 font-semibold" : ""}>
                              {r.distanceKm.toFixed(3)}
                              {MAX_KM && r.distanceKm > MAX_KM ? " !" : ""}
                            </span>
                          ) : (
                            ""
                          )
                        ) : (
                          // No checkout GPS to compare
                          "No check out GPS"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex w-full justify-center rounded px-2 py-1 text-sm font-medium ${rowBg(
                            r.status
                          )}`}
                        >
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

        {/* Back button */}
        <div className="mt-6 flex justify-center">
          <Link
            href={homeHref}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-[#E8CC5C] px-6 py-3 text-gray-900 hover:bg-[#e3c54a] border border-black/20 text-center"
          >
            Back to summary page
          </Link>
        </div>
      </div>
    </div>
  );
}





