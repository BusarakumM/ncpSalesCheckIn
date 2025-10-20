"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = { date: string; leaveType: string; reason: string; name?: string; email?: string; employeeNo?: string; district?: string };

export default function LeaveManageClient() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState(""); // email or emp no
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (q) {
      // try both employeeNo and email server-side
      qs.set("employeeNo", q);
      qs.set("email", q);
    }
    const r = await fetch(`/api/pa/leave?${qs.toString()}`, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to load leaves");
    setRows(data.rows as Row[]);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        <div className="flex items-center gap-2">
          <Link href="/supervisor" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50" title="Back">
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold">Leave Submissions</h1>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" placeholder="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" placeholder="To" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="bg-white" placeholder="Employee No or Email" />
        </div>
        <div className="mt-3 flex justify-center">
          <Button onClick={load} className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10">Search</Button>
        </div>

        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto bg-white border border-black/20 rounded-md">
            <Table className="min-w-[800px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead className="min-w-[120px]">Emp No</TableHead>
                  <TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead className="min-w-[200px]">Email</TableHead>
                  <TableHead className="min-w-[120px]">District</TableHead>
                  <TableHead className="min-w-[140px]">Leave Type</TableHead>
                  <TableHead className="min-w-[240px]">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">No data</TableCell>
                  </TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell>{r.employeeNo || ""}</TableCell>
                    <TableCell>{r.name || ""}</TableCell>
                    <TableCell className="truncate">{r.email || ""}</TableCell>
                    <TableCell>{r.district || ""}</TableCell>
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

