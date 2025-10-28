"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/utils";

type Row = { date: string; leaveType: string; reason: string };

export default function LeaveHistoryClient({ email, employeeNo }: { email: string; employeeNo: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

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
    setRows((data.rows || []).map((x: any) => ({ date: x.date, leaveType: x.leaveType, reason: x.reason })) as Row[]);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  function clearFilters() {
    setFrom("");
    setTo("");
    load().catch(() => {});
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        <div className="flex items-center gap-2">
          <Link href="/home" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50" title="Back">
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold">My Leave History</h1>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" placeholder="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" placeholder="To" />
        </div>
        <div className="mt-3 flex justify-center gap-3">
          <Button onClick={() => load().catch(() => {})} className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10">Search</Button>
          <Button onClick={clearFilters} className="rounded-full bg-white text-gray-900 hover:bg-gray-50 border border-black/20 px-6 sm:px-10">Clear filters</Button>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto overflow-y-auto max-h-[240px] bg-white border border-black/20 rounded-md">
            <Table className="min-w-[600px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[160px]">Date</TableHead>
                  <TableHead className="min-w-[180px]">Leave Type</TableHead>
                  <TableHead className="min-w-[260px]">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">No data</TableCell>
                  </TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell title={formatDateDisplay(r.date) === "–" ? "Missing or invalid date" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{r.reason}</TableCell>
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
