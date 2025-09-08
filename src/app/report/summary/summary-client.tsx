"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ---- Mock data (per your screenshot) ----
type Row = { name: string; total: number; completed: number; incomplete: number; ongoing: number };
const DATA: Row[] = [
  { name: "นาย A", total: 3, completed: 3, incomplete: 0, ongoing: 0 },
  { name: "นาย B", total: 3, completed: 0, incomplete: 0, ongoing: 3 },
  { name: "นาย C", total: 3, completed: 3, incomplete: 0, ongoing: 0 },
  { name: "นาย D", total: 3, completed: 0, incomplete: 3, ongoing: 0 },
];

export default function SummaryClient({ homeHref }: { homeHref: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // In the future, use from/to to fetch filtered data.
  const rows = DATA;

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
      <div className="mx-auto max-w-md px-4 pt-4 pb-10">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-2xl font-extrabold">Sales Supports Summary</h1>
        </div>

        {/* Filter */}
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Filter : Date</div>
          <div className="grid grid-cols-2 gap-3">
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
            <Button className="rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20">
              OK
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-5 grid grid-cols-5 gap-3 items-stretch">
          {/* Members (avatar + big number) */}
          <Card className="col-span-1 border-none bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center p-0">
              <div className="h-10 w-10 rounded-full bg-black/80 mb-1" />
              <div className="text-2xl font-extrabold">{kpis.members}</div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="col-span-1 border-none bg-transparent shadow-none">
            <CardContent className="p-0 text-center">
              <div className="text-sm">Total</div>
              <div className="text-2xl font-extrabold">{kpis.total}</div>
            </CardContent>
          </Card>

          {/* Completed (green) */}
          <Card className="col-span-1 border-none bg-[#BFD9C8]">
            <CardContent className="p-2 text-center">
              <div className="text-sm opacity-80">Completed</div>
              <div className="text-2xl font-extrabold">{kpis.completed}</div>
            </CardContent>
          </Card>

          {/* Incomplete (red) */}
          <Card className="col-span-1 border-none bg-[#E9A0A0]">
            <CardContent className="p-2 text-center">
              <div className="text-sm opacity-80">Incomplete</div>
              <div className="text-2xl font-extrabold">{kpis.incomplete}</div>
            </CardContent>
          </Card>

          {/* Ongoing (yellow) */}
          <Card className="col-span-1 border-none bg-[#F3E099]">
            <CardContent className="p-2 text-center">
              <div className="text-sm opacity-80">Ongoing</div>
              <div className="text-2xl font-extrabold">{kpis.ongoing}</div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Table (beige panel with rounded rows) */}
        <div className="mt-6 rounded-3xl bg-[#D9CDAF] p-4">
          <h2 className="mb-3 text-center text-xl font-extrabold">Summary Table</h2>

          {/* Header row */}
          <div className="grid grid-cols-5 px-2 pb-2 text-sm font-medium">
            <div>Sale support name</div>
            <div className="text-center">Task total</div>
            <div className="text-center">Completed</div>
            <div className="text-center">Incomplete</div>
            <div className="text-center">Ongoing</div>
          </div>

          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.name}
                className="grid grid-cols-5 items-center rounded-2xl bg-white px-3 py-3 shadow-sm"
              >
                <div className="truncate">{r.name}</div>
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
  );
}
