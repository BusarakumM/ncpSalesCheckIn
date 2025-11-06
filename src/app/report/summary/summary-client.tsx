"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ---- Mock data (per your screenshot) ----
type Row = { name: string; district?: string; total: number; completed: number; incomplete: number; ongoing: number };
const DATA: Row[] = [];

export default function SummaryClient({ homeHref }: { homeHref: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qDistrict, setQDistrict] = useState("");

  
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const res = await fetch("/api/pa/report/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, district: qDistrict })
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load summary");
    setRows(data.summary as Row[]);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  const kpis = useMemo(() => {
    const members = rows.length;
    const total = rows.reduce((s, r) => s + r.total, 0);
    const completed = rows.reduce((s, r) => s + r.completed, 0);
    const incomplete = rows.reduce((s, r) => s + r.incomplete, 0);
    const ongoing = rows.reduce((s, r) => s + r.ongoing, 0);
    return { members, total, completed, incomplete, ongoing };
  }, [rows]);

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
            Sales Supports Summary
          </h1>
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
            <div>
              <Label className="mb-1 block">District</Label>
              <Input value={qDistrict} onChange={(e) => setQDistrict(e.target.value)} placeholder="District" className="bg-white" />
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <Button onClick={load} className="rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 px-6 sm:px-10">
              OK
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3 items-stretch">
          {/* Members (avatar + big number) */}
          <Card className="border-none bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center p-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/80 mb-1" />
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.members}</div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="border-none bg-transparent shadow-none">
            <CardContent className="p-0 text-center">
              <div className="text-sm">Total</div>
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.total}</div>
            </CardContent>
          </Card>

          {/* Completed (green) */}
          <Card className="border-none bg-[#BFD9C8]">
            <CardContent className="p-2 sm:p-3 text-center">
              <div className="text-sm opacity-80">Completed</div>
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.completed}</div>
            </CardContent>
          </Card>

          {/* Incomplete (red) */}
          <Card className="border-none bg-[#E9A0A0]">
            <CardContent className="p-2 sm:p-3 text-center">
              <div className="text-sm opacity-80">Incomplete</div>
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.incomplete}</div>
            </CardContent>
          </Card>

          {/* Ongoing (yellow) */}
          <Card className="border-none bg-[#F3E099]">
            <CardContent className="p-2 sm:p-3 text-center">
              <div className="text-sm opacity-80">Ongoing</div>
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.ongoing}</div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Table (beige panel with rounded rows) */}
        <div className="mt-6 rounded-3xl bg-[#D9CDAF] p-4">
          <div className="mb-2 flex justify-end">
            <Button
              onClick={() => {
                const header = ["Name","District","Total","Completed","Incomplete","Ongoing"];
                const lines = rows.map((r) => [r.name, r.district || "", r.total, r.completed, r.incomplete, r.ongoing]);
                const csv = [header, ...lines]
                  .map(row => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                  .join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "summary.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              variant="outline"
              className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2"
            >
              Export
            </Button>
          </div>
          <h2 className="mb-3 text-center text-lg sm:text-xl font-extrabold">Summary Table</h2>

          {/* Wrap in horizontal scroll on small screens */}
          <div className="overflow-x-auto">
            {/* Use a min-width grid so columns don't squish on phones */}
            <div className="min-w-[680px]">
              {/* Header row */}
              <div className="grid grid-cols-6 px-2 pb-2 text-sm font-medium">
                <div>Sale support name</div>
                <div className="text-center">District</div>
                <div className="text-center">Task total</div>
                <div className="text-center">Completed</div>
                <div className="text-center">Incomplete</div>
                <div className="text-center">Ongoing</div>
              </div>

              <div className="space-y-3">
                {rows.length === 0 ? (<div className="text-center text-gray-600">No data</div>) : rows.map((r) => (
                  <div
                    key={r.name}
                    className="grid grid-cols-6 items-center rounded-2xl bg-white px-3 py-3 shadow-sm"
                  >
                    <div className="truncate">{r.name}</div>
                    <div className="text-center font-semibold">{r.district || ""}</div>
                    <div className="text-center font-semibold">{r.total}</div>
                    <div className="text-center font-semibold">{r.completed}</div>
                    <div className="text-center font-semibold">{r.incomplete}</div>
                    <div className="text-center font-semibold">{r.ongoing}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Export moved above table for consistency */}

      </div>
    </div>
  );
}




