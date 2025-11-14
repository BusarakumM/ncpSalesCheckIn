"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = { dateTime: string; name: string; email: string; employeeNo?: string; leaveType: string; remark?: string };
type Holiday = { date: string; name: string; type?: string };

export default function CalendarClient({ homeHref }: { homeHref: string }) {
  const [gtsCal, setGtsCal] = useState(false);
  const [mtsCal, setMtsCal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [weeklyEmpNo, setWeeklyEmpNo] = useState("");
  const [dt, setDt] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [remark, setRemark] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [mon, setMon] = useState(false);
  const [tue, setTue] = useState(false);
  const [wed, setWed] = useState(false);
  const [thu, setThu] = useState(false);
  const [fri, setFri] = useState(false);
  const [sat, setSat] = useState(false);
  const [sun, setSun] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  function onAdd() {
    if (!name || (!email && !employeeNo) || !dt || !leaveType)
      return alert("Please fill Name, Employee No or Username, Date/Time and Leave Type.");
    setRows((r) => [{ dateTime: dt, name, email, employeeNo, leaveType, remark }, ...r]);
    setLeaveType("");
    setRemark("");
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFileName(f.name);
  }

  async function fetchHolidays() {
    const today = new Date();
    const y = today.getFullYear();
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    const r = await fetch(`/api/pa/calendar/holidays?from=${from}&to=${to}`, { cache: "no-store" });
    const data = await r.json();
    if (r.ok && data?.ok) setHolidays(data.holidays as Holiday[]);
  }

  async function loadWeekly() {
    if (!weeklyEmpNo) return;
    const r = await fetch(`/api/pa/calendar/weekly?employeeNo=${encodeURIComponent(weeklyEmpNo)}`, { cache: "no-store" });
    const data = await r.json();
    if (r.ok && data?.ok && data?.config) {
      setMon(!!data.config.mon); setTue(!!data.config.tue); setWed(!!data.config.wed);
      setThu(!!data.config.thu); setFri(!!data.config.fri); setSat(!!data.config.sat); setSun(!!data.config.sun);
    }
  }

  async function saveWeekly() {
    if (!weeklyEmpNo) return alert("Please fill Employee No");
    const r = await fetch(`/api/pa/calendar/weekly`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeNo: weeklyEmpNo, mon, tue, wed, thu, fri, sat, sun })
    });
    const data = await r.json();
    if (!r.ok || !data?.ok) return alert(data?.error || "Save failed");
    alert("Weekly calendar saved");
  }

  async function submitDayOff(row: Row) {
    const r = await fetch(`/api/pa/calendar/dayoff`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeNo: row.employeeNo, email: row.email, dateISO: row.dateTime, leaveType: row.leaveType, remark: row.remark })
    });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "Add day-off failed");
  }

  useEffect(() => { fetchHolidays().catch(() => {}); }, []);

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

        {/* Toggles / Controls */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setGtsCal((v) => !v)}
            className={`rounded-xl px-4 py-3 text-left border ${
              gtsCal ? "bg-[#BFD9C8] border-black/20" : "bg-white border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={gtsCal} readOnly />
              <span className="font-medium">GTS Calendar</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMtsCal((v) => !v)}
            className={`rounded-xl px-4 py-3 text-left border ${
              mtsCal ? "bg-[#BFD9C8] border-black/20" : "bg-white border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={mtsCal} readOnly />
              <span className="font-medium">MTS Calendar</span>
            </div>
          </button>
        </div>

        {/* Weekly off config (supervisor sets by agent) */}
        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label>Sales support Employee No</Label>
                <Input value={weeklyEmpNo} onChange={(e) => setWeeklyEmpNo(e.target.value)} className="bg-white" onBlur={loadWeekly} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Weekly day-off</Label>
                <div className="flex flex-wrap gap-3 bg-white rounded-md border border-black/10 p-2">
                  {[
                    { k: "Mon", v: mon, s: setMon }, { k: "Tue", v: tue, s: setTue }, { k: "Wed", v: wed, s: setWed },
                    { k: "Thu", v: thu, s: setThu }, { k: "Fri", v: fri, s: setFri }, { k: "Sat", v: sat, s: setSat }, { k: "Sun", v: sun, s: setSun },
                  ].map((d) => (
                    <label key={d.k} className="inline-flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={d.v} onChange={(e) => d.s(e.target.checked)} /> {d.k}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-3">
                <Button onClick={saveWeekly} className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20">Save Weekly Calendar</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company holidays list */}
        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4">
            <h2 className="text-lg font-bold mb-3">Company Holidays</h2>
            <div className="overflow-x-auto overflow-y-auto max-h-[240px] rounded-md border border-black/10 bg-white">
              <Table className="min-w-[480px] text-sm">
                <TableHeader>
                  <TableRow className="[&>*]:bg-[#C6E0CF]">
                    <TableHead className="min-w-[140px]">Date</TableHead>
                    <TableHead className="min-w-[240px]">Name</TableHead>
                    <TableHead className="min-w-[140px]">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">No holidays</TableCell>
                    </TableRow>
                  ) : holidays.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>{h.type || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Entry card: inputs stack on mobile, pair up on md+ */}
        <Card className="mt-4 border-none bg-[#BFD9C8]">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Sales support name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Employee No</Label>
                <Input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Username (optional)</Label>
                <Input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white" />
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
                  onClick={async () => { try { onAdd(); await submitDayOff({ dateTime: dt, name, email, leaveType, remark }); } catch (e: any) { alert(e?.message || 'Failed'); } }}
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
                  <TableHead className="min-w-[120px]">Emp No</TableHead>
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
                      <TableCell>{r.employeeNo || ""}</TableCell>
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
