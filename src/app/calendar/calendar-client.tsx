"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = { dateTime: string; name: string; email: string; leaveType: string; remark?: string };

export default function CalendarClient({ homeHref }: { homeHref: string }) {
  const [companyCal, setCompanyCal] = useState(false);
  const [supportCal, setSupportCal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dt, setDt] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [remark, setRemark] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function onAdd() {
    if (!name || !email || !dt || !leaveType)
      return alert("Please fill Name, E-mail, Date/Time and Leave Type.");
    setRows((r) => [{ dateTime: dt, name, email, leaveType, remark }, ...r]);
    setLeaveType("");
    setRemark("");
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFileName(f.name);
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      {/* Top container: fluid with max width by breakpoint */}
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Header: home on left, title centered; stacks nicely on mobile */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold">
            Calendar
          </h1>
        </div>

        {/* Toggles: 1 column on phones, 2 on >= sm */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCompanyCal((v) => !v)}
            className={`rounded-xl px-4 py-3 text-left border ${
              companyCal ? "bg-[#BFD9C8] border-black/20" : "bg-white border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={companyCal} readOnly />
              <span className="font-medium">Company Calendar</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSupportCal((v) => !v)}
            className={`rounded-xl px-4 py-3 text-left border ${
              supportCal ? "bg-[#BFD9C8] border-black/20" : "bg-white border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={supportCal} readOnly />
              <span className="font-medium">Sales Support Calendar</span>
            </div>
          </button>
        </div>

        {/* Entry card: inputs stack on mobile, pair up on md+ */}
        <Card className="mt-4 border-none bg-[#BFD9C8]">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Sales support name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Date/time</Label>
                <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Leave Type</Label>
                <Input
                  placeholder="ลากิจ / ลาป่วย / ลาพักร้อน …"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Remark takes full width on md+ */}
              <div className="md:col-span-2 space-y-1">
                <Label>Remark</Label>
                <Input
                  placeholder="Optional"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="md:col-span-2 pt-1">
                <Button
                  onClick={onAdd}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20"
                >
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List area: full-width band with fluid inner container */}
      <div className="mt-6 bg-[#BFD9C8]">
        <div className="mx-auto w-full px-4 sm:px-6 md:px-8 py-4 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold">Sales support holiday list</h2>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm hover:bg-gray-50 self-start sm:self-auto">
              <input type="file" accept=".xlsx" className="hidden" onChange={onUpload} />
              <span>Upload excel file</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white">↑</span>
            </label>
          </div>

          <div className="text-xs text-gray-700 mb-2">
            {uploadedFileName ? <>Selected: <b>{uploadedFileName}</b></> : "No file selected"}
          </div>

          {/* Table wrapper: horizontal scroll on small screens */}
          <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
            <Table className="min-w-[600px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF]">
                  <TableHead className="min-w-[160px]">Date/Time</TableHead>
                  <TableHead className="min-w-[180px]">Sales Support name</TableHead>
                  <TableHead className="min-w-[140px]">Leave type</TableHead>
                  <TableHead className="min-w-[200px]">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      No items yet. Add above or upload an excel file.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.dateTime.replace("T", " ")}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.leaveType}</TableCell>
                      <TableCell>{r.remark ?? ""}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <Button className="w-full rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20">
              Submit &amp; Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
