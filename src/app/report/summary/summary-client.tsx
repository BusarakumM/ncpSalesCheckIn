"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// ---- Mock data (per your screenshot) ----
type Row = { name: string; employeeNo?: string; group?: string; district?: string; total: number; completed: number; incomplete: number; ongoing: number };
const DATA: Row[] = [];

export default function SummaryClient({ homeHref }: { homeHref: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qDistrict, setQDistrict] = useState("");
  const [qGroup, setQGroup] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [rows, setRows] = useState<Row[]>([]);

  async function load(overrides?: Partial<{ from: string; to: string; district: string; group: string; search: string }>) {
    const nextFrom = overrides?.from ?? from;
    const nextTo = overrides?.to ?? to;
    const nextDistrict = overrides?.district ?? qDistrict;
    const nextGroup = overrides?.group ?? qGroup;
    const nextSearch = overrides?.search ?? qSearch;
    const payload: Record<string, string> = {};
    if (nextFrom) payload.from = nextFrom;
    if (nextTo) payload.to = nextTo;
    if (nextDistrict) payload.district = nextDistrict;
    if (nextGroup) payload.group = nextGroup;
    if (nextSearch) payload.search = nextSearch;
    const res = await fetch("/api/pa/report/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load summary");
    setRows(data.summary as Row[]);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  async function handleApply() {
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setFrom("");
    setTo("");
    setQDistrict("");
    setQGroup("");
    setQSearch("");
    try {
      await load({ from: "", to: "", district: "", group: "", search: "" });
    } finally {
      setClearing(false);
    }
  }

  const kpis = useMemo(() => {
    const members = rows.length;
    const total = rows.reduce((s, r) => s + r.total, 0);
    const completed = rows.reduce((s, r) => s + r.completed, 0);
    const incomplete = rows.reduce((s, r) => s + r.incomplete, 0);
    const ongoing = rows.reduce((s, r) => s + r.ongoing, 0);
    return { members, total, completed, incomplete, ongoing };
  }, [rows]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    if (e.deltaY === 0) return;
    scrollRef.current.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  const buildActivityHref = (status: "completed" | "incomplete" | "ongoing") => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (qDistrict) params.set("district", qDistrict);
    params.set("status", status);
    const qs = params.toString();
    return qs ? `/activity?${qs}` : "/activity";
  };

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="กลับหน้าหลัก"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            สรุปผลงานทีมเซลส์ซัพพอร์ต
          </h1>
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          <div>
            <Label className="mb-1 block">ช่วงวันที่</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" placeholder="จากวันที่" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" placeholder="ถึงวันที่" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block">กลุ่ม</Label>
              <Input value={qGroup} onChange={(e) => setQGroup(e.target.value)} placeholder="ชื่อกลุ่ม" className="bg-white" />
            </div>
            <div>
              <Label className="mb-1 block">เขต</Label>
              <Input value={qDistrict} onChange={(e) => setQDistrict(e.target.value)} placeholder="ชื่อเขต" className="bg-white" />
            </div>
            <div>
              <Label className="mb-1 block">รหัสพนักงานหรือชื่อ</Label>
              <Input value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="รหัสพนักงาน หรือชื่อ" className="bg-white" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Button
              onClick={handleApply}
              disabled={loading || clearing}
              className="rounded-full bg-[#BFD9C8] text-gray-900 hover:bg-[#b3d0bf] border border-black/10 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังโหลด...
                </>
              ) : (
                "ตกลง"
              )}
            </Button>
            <Button
              onClick={handleClear}
              disabled={loading || clearing}
              variant="outline"
              className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังล้างค่า...
                </>
              ) : (
                "ล้างทั้งหมด"
              )}
            </Button>
          </div>
        </div>

        {/* Summary Table (beige panel with rounded rows) */}
        <div className="mt-6 rounded-3xl bg-[#D9CDAF] p-4">
          <div className="mb-2 flex justify-between items-center">
            <div />
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2 disabled:opacity-60"
              >
                {refreshing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />รีเฟรช</> : "รีเฟรช"}
              </Button>
              <Button
                onClick={() => {
                  const header = ["กลุ่ม","เขต","รหัสพนักงาน","ชื่อเซลส์ซัพพอร์ต","รวมงาน","เสร็จสิ้น","ไม่เสร็จ","กำลังทำ"];
                  const lines = rows.map((r) => [
                    r.group || "",
                    r.district || "",
                    r.employeeNo || "",
                    r.name,
                    r.total,
                    r.completed,
                    r.incomplete,
                    r.ongoing,
                  ]);
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
                ส่งออก
              </Button>
            </div>
          </div>
          <h2 className="mb-3 text-center text-lg sm:text-xl font-extrabold">ตารางสรุป</h2>

          {/* Wrap in horizontal scroll on small screens */}
          <div
            ref={scrollRef}
            onWheel={handleWheelScroll}
            className="relative overflow-x-auto pb-1"
          >
            {/* Use a min-width grid so columns don't squish on phones */}
            <div className="min-w-[900px]">
              {/* Header row */}
              <div className="sticky top-0 z-20 grid grid-cols-8 px-2 pb-2 text-sm font-medium bg-[#D9CDAF]">
                <div className="text-center">กลุ่ม</div>
                <div className="text-center">เขต</div>
                <div className="text-center">รหัสพนักงาน</div>
                <div>ชื่อเซลส์ซัพพอร์ต</div>
                <div className="text-center">รวมงาน</div>
                <div className="text-center">เสร็จสิ้น</div>
                <div className="text-center">ไม่เสร็จ</div>
                <div className="text-center">กำลังทำ</div>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 max-h-[60vh] sm:max-h-[65vh] lg:max-h-[70vh]">
                {rows.length === 0 ? (<div className="text-center text-gray-600">ไม่มีข้อมูล</div>) : rows.map((r, idx) => (
                  <div
                    key={`${r.employeeNo || r.name || "row"}-${idx}`}
                    className="grid grid-cols-8 items-center rounded-2xl bg-white px-3 py-3 shadow-sm gap-2"
                  >
                    <div className="text-center font-semibold">{r.group || "-"}</div>
                    <div className="text-center font-semibold">{r.district || ""}</div>
                    <div className="text-center font-semibold">{r.employeeNo || "-"}</div>
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

        {/* KPI row */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 items-stretch">
          {/* Members (avatar + big number) */}
          <Card className="border-none bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center p-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/80 mb-1" />
              <div className="text-sm text-gray-600">จำนวนคน</div>
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.members}</div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="border-none bg-transparent shadow-none">
            <CardContent className="p-0 text-center">
              <div className="text-sm">รวมงานทั้งหมด</div>
              <div className="text-xl sm:text-2xl font-extrabold">{kpis.total}</div>
            </CardContent>
          </Card>

          {/* Completed (green) */}
          <Link
            href={buildActivityHref("completed")}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4f9c7a] rounded-2xl"
            aria-label="ดูรายการที่เสร็จสิ้น"
          >
            <Card className="border-none bg-[#BFD9C8] hover:shadow-md transition cursor-pointer">
              <CardContent className="p-2 sm:p-3 text-center">
                <div className="text-sm opacity-80">เสร็จสิ้น</div>
                <div className="text-xl sm:text-2xl font-extrabold">{kpis.completed}</div>
              </CardContent>
            </Card>
          </Link>

          {/* Incomplete (red) */}
          <Link
            href={buildActivityHref("incomplete")}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#c06c6c] rounded-2xl"
            aria-label="ดูรายการที่ยังไม่เสร็จ"
          >
            <Card className="border-none bg-[#E9A0A0] hover:shadow-md transition cursor-pointer">
              <CardContent className="p-2 sm:p-3 text-center">
                <div className="text-sm opacity-80">ยังไม่เสร็จ</div>
                <div className="text-xl sm:text-2xl font-extrabold">{kpis.incomplete}</div>
              </CardContent>
            </Card>
          </Link>

          {/* Ongoing (yellow) */}
          <Link
            href={buildActivityHref("ongoing")}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#d3b652] rounded-2xl"
            aria-label="ดูรายการที่กำลังทำ"
          >
            <Card className="border-none bg-[#F3E099] hover:shadow-md transition cursor-pointer">
              <CardContent className="p-2 sm:p-3 text-center">
                <div className="text-sm opacity-80">กำลังทำ</div>
                <div className="text-xl sm:text-2xl font-extrabold">{kpis.ongoing}</div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Export moved above table for consistency */}

      </div>
    </div>
  );
}
