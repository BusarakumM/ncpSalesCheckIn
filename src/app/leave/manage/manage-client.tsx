 "use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Row = { date: string; leaveType: string; reason: string; imageUrl?: string; name?: string; email?: string; employeeNo?: string; district?: string; group?: string };

export default function LeaveManageClient() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qGroup, setQGroup] = useState("");
  const [qDistrict, setQDistrict] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function deleteRow(r: Row) {
    if (!r?.date) return;
    const id = r.employeeNo || r.email || "";
    const label = `${r.date} – ${r.leaveType} ${r.name ? `(${r.name})` : id ? `(${id})` : ""}`.trim();
    if (!confirm(`ยืนยันการลบข้อมูลการลานี้หรือไม่?\n${label}`)) return;
    const res = await fetch("/api/pa/leave/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dt: r.date, employeeNo: r.employeeNo, email: r.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(data?.error || "ลบข้อมูลไม่สำเร็จ");
      return;
    }
    await handleApply();
  }

  function exportCsv() {
    const header = ["วันที่","รหัสพนักงาน","ชื่อ","ชื่อผู้ใช้","เขต","กลุ่ม","ประเภทการลา","เหตุผล","รูปภาพ"];
    const lines = rows.map((r) => [
      r.date,
      r.employeeNo || "",
      r.name || "",
      r.email || "",
      r.district || "",
      r.group || "",
      r.leaveType,
      r.reason,
      r.imageUrl || "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leave-submissions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function load(overrides?: Partial<{ from: string; to: string; group: string; district: string; search: string }>) {
    const nextFrom = overrides?.from ?? from;
    const nextTo = overrides?.to ?? to;
    const nextGroup = overrides?.group ?? qGroup;
    const nextDistrict = overrides?.district ?? qDistrict;
    const nextSearch = overrides?.search ?? qSearch;
    const qs = new URLSearchParams();
    if (nextFrom) qs.set("from", nextFrom);
    if (nextTo) qs.set("to", nextTo);
    if (nextGroup) qs.set("group", nextGroup);
    if (nextDistrict) qs.set("district", nextDistrict);
    if (nextSearch) qs.set("search", nextSearch);
    const r = await fetch(`/api/pa/leave?${qs.toString()}`, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "โหลดข้อมูลการลาไม่สำเร็จ");
    setRows(data.rows as Row[]);
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
    setQGroup("");
    setQDistrict("");
    setQSearch("");
    try {
      await load({ from: "", to: "", group: "", district: "", search: "" });
    } finally {
      setClearing(false);
    }
  }

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

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        <div className="flex items-center gap-2">
          <Link href="/supervisor" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50" title="ย้อนกลับ">
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">รายการคำขอลา</h1>
        </div>

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
              <Input value={qGroup} onChange={(e) => setQGroup(e.target.value)} className="bg-white" placeholder="ชื่อกลุ่ม" />
            </div>
            <div>
              <Label className="mb-1 block">เขต</Label>
              <Input value={qDistrict} onChange={(e) => setQDistrict(e.target.value)} className="bg-white" placeholder="ชื่อเขต" />
            </div>
            <div>
              <Label className="mb-1 block">รหัสพนักงานหรือชื่อ</Label>
              <Input value={qSearch} onChange={(e) => setQSearch(e.target.value)} className="bg-white" placeholder="รหัสพนักงาน หรือชื่อ" />
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

        {/* Export */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="mb-2 flex justify-between items-center">
            <div />
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={refreshing || loading || clearing}
                variant="outline"
                className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2 disabled:opacity-60"
              >
                {refreshing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />รีเฟรช</> : "รีเฟรช"}
              </Button>
              <Button onClick={exportCsv} variant="outline" className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2">
                ส่งออก
              </Button>
            </div>
          </div>
          <div
            ref={scrollRef}
            onWheel={handleWheelScroll}
            className="relative bg-white border border-black/20 rounded-md overflow-x-auto pb-1"
          >
            <div className="max-h-[60vh] sm:max-h-[65vh] lg:max-h-[70vh] overflow-y-auto">
            <Table className="w-full text-xs sm:text-sm">
              <TableHeader className="sticky top-0 z-20 bg-[#C6E0CF]">
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="w-[11%]">วันที่</TableHead>
                  <TableHead className="w-[11%]">รหัสพนักงาน</TableHead>
                  <TableHead className="w-[12%]">ชื่อ</TableHead>
                  <TableHead className="w-[15%]">ชื่อผู้ใช้</TableHead>
                  <TableHead className="w-[10%]">เขต</TableHead>
                  <TableHead className="w-[10%]">กลุ่ม</TableHead>
                  <TableHead className="w-[12%]">ประเภทการลา</TableHead>
                  <TableHead className="w-[14%]">เหตุผล</TableHead>
                  <TableHead className="w-[10%]">รูปภาพ</TableHead>
                  <TableHead className="w-[5%] text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">ไม่มีข้อมูล</TableCell>
                  </TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell title={formatDateDisplay(r.date) === "–" ? "ข้อมูลวันที่ไม่ถูกต้อง" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                    <TableCell>{r.employeeNo || ""}</TableCell>
                    <TableCell>{r.name || ""}</TableCell>
                    <TableCell className="truncate">{r.email || ""}</TableCell>
                    <TableCell>{r.district || ""}</TableCell>
                    <TableCell>{r.group || ""}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{r.reason}</TableCell>
                    <TableCell>
                      {r.imageUrl ? (
                        <a
                          href={r.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={r.imageUrl}
                            alt="หลักฐานการลา"
                            className="h-16 w-auto rounded border border-black/10"
                          />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">ไม่มี</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => deleteRow(r)}
                        title="ลบ"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
                      >
                        🗑️
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
