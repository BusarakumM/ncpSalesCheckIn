"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/utils";

type Row = { date: string; leaveType: string; reason: string; imageUrl?: string };

export default function LeaveHistoryClient({ email, employeeNo }: { email: string; employeeNo: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  function exportCsv() {
    const header = ["Date","Leave Type","Reason"];
    const lines = rows.map((r) => [r.date, r.leaveType, r.reason]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-leave-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function load() {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (employeeNo) qs.set("employeeNo", employeeNo);
    else if (email) qs.set("email", email);
    const r = await fetch(`/api/pa/leave?${qs.toString()}`, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to load leaves");
    setRows((data.rows || []).map((x: any) => ({ date: x.date, leaveType: x.leaveType, reason: x.reason, imageUrl: x.imageUrl })) as Row[]);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  async function clearFilters() {
    setFrom("");
    setTo("");
    setIsFiltering(true);
    try { await load(); } finally { setIsFiltering(false); }
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        <div className="flex items-center gap-2">
          <Link href="/home" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50" title="ย้อนกลับ">
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold">ประวัติการลา</h1>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" placeholder="จากวันที่" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" placeholder="ถึงวันที่" />
        </div>
        <div className="mt-3 flex justify-center gap-3">
          <Button
            onClick={() => { setIsFiltering(true); load().catch(() => {}).finally(() => setIsFiltering(false)); }}
            disabled={isFiltering}
            className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isFiltering ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>กำลังโหลด...</>) : 'ตกลง'}
          </Button>
          <Button
            onClick={clearFilters}
            disabled={isFiltering}
            className="rounded-full bg-white text-gray-900 hover:bg-gray-50 border border-black/20 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isFiltering ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>ล้างตัวกรอง</>) : 'ล้างตัวกรอง'}
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          {/* Export hidden for sales support */}
          <div className="overflow-x-auto overflow-y-auto max-h-[240px] bg-white border border-black/20 rounded-md">
            <Table className="min-w-[600px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[160px]">วันที่</TableHead>
                  <TableHead className="min-w-[180px]">ประเภทการลา</TableHead>
                  <TableHead className="min-w-[260px]">เหตุผล</TableHead>
                  <TableHead className="min-w-[160px]">รูปแนบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">ไม่มีข้อมูล</TableCell>
                  </TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell title={formatDateDisplay(r.date) === "–" ? "Missing or invalid date" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{r.reason}</TableCell>
                    <TableCell>
                      {r.imageUrl ? (
                        <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.imageUrl} alt="leave" className="h-16 w-auto rounded border border-black/10" />
                        </a>
                      ) : ("-")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>
    </div>
  );
}
