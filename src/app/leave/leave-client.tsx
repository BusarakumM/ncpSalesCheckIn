"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = {
  dt: string;
  type: string;
  reason: string;
  // local-only metadata (for duplicate/overlap detection)
  mode?: "full" | "hourly";
  date?: string; // YYYY-MM-DD (from input)
  startMinutes?: number; // minutes from 00:00
  endMinutes?: number;   // minutes from 00:00
};

export default function LeaveClient({ homeHref }: { homeHref: string }) {
  // form
  // leave mode: full-day or hourly
  const [mode, setMode] = useState<"full" | "hourly">("full");
  // full-day fields
  const [fullDate, setFullDate] = useState("");
  // hourly fields
  const [hourDate, setHourDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");

  // saved rows (local mock)
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Click locks to prevent rapid double presses
  const saveLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const submitSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (notice) {
      // Ensure the message is visible near the submit button
      const el = noticeRef.current || submitSectionRef.current;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [notice]);

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAllRows() {
    if (rows.length === 0) return;
    if (confirm(`Clear all ${rows.length} item(s)?`)) {
      setRows([]);
    }
  }

  function toIso(dtLocal: string): string {
    try {
      return new Date(dtLocal).toISOString();
    } catch {
      return dtLocal;
    }
  }

  function datePartUTC(iso: string): string {
    try {
      const d = new Date(iso);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return String(iso).substring(0, 10);
    }
  }

  function toMinutes(hhmm: string): number {
    const [hh, mi] = (hhmm || "").split(":");
    const h = Number(hh);
    const m = Number(mi);
    if (!isFinite(h) || !isFinite(m)) return 0;
    return h * 60 + m;
  }

  function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
    return Math.max(a.start, b.start) < Math.min(a.end, b.end);
  }

  function parseSpanFromType(typeText: string): { start: number; end: number } | null {
    if (!typeText) return null;
    if (/\(\s*Full\s*Day\s*\)/i.test(typeText)) return { start: 0, end: 24 * 60 };
    const m = typeText.match(/\(\s*Hourly\s+([0-2]?\d:[0-5]\d)\s*-\s*([0-2]?\d:[0-5]\d)\s*\)/i);
    if (m) {
      const s = toMinutes(m[1]);
      const e = toMinutes(m[2]);
      if (e > s) return { start: s, end: e };
    }
    return null;
  }

  function getLocalRowSpan(r: Row): { date: string; start: number; end: number } | null {
    const date = r.date || (r.dt ? datePartUTC(toIso(r.dt)) : "");
    if (!date) return null;
    if (r.startMinutes != null && r.endMinutes != null) return { date, start: r.startMinutes!, end: r.endMinutes! };
    const parsed = parseSpanFromType(r.type || "");
    if (parsed) return { date, start: parsed.start, end: parsed.end };
    // fallback: treat unknown as a point-in-time (1 minute)
    try {
      const d = new Date(toIso(r.dt));
      const s = d.getUTCHours() * 60 + d.getUTCMinutes();
      return { date, start: s, end: s + 1 };
    } catch {
      return { date, start: 0, end: 0 };
    }
  }

  function getServerRowSpan(sr: any): { date: string; start: number; end: number } | null {
    const iso = String(sr?.date || "");
    if (!iso) return null;
    const date = datePartUTC(iso);
    const parsed = parseSpanFromType(String(sr?.leaveType || ""));
    if (parsed) return { date, start: parsed.start, end: parsed.end };
    // fallback to a point span based on ISO time
    try {
      const d = new Date(iso);
      const s = d.getUTCHours() * 60 + d.getUTCMinutes();
      return { date, start: s, end: s + 1 };
    } catch {
      return { date, start: 0, end: 0 };
    }
  }

  function exportCsv() {
    const header = ["Date/Time", "Leave type", "Reason"];
    const lines = rows.map((r) => [r.dt.replace("T", " "), r.type, r.reason]);
    const csv = [header, ...lines]
      .map(row => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leave.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onSave() {
    // Guard against double-click
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    // Validate common fields
    if (!type || !reason) {
      alert("Please fill Leave Type and Reason.");
      saveLockRef.current = false;
      return;
    }

    let computedDt = "";
    let computedType = type;
    let metaDate = "";
    let metaStart = 0;
    let metaEnd = 0;

    if (mode === "full") {
      if (!fullDate) {
        alert("Please select the date for Full Day leave.");
        saveLockRef.current = false;
        return;
      }
      // Use midnight local time for full-day
      computedDt = `${fullDate}T00:00`;
      computedType = `${type} (Full Day)`;
      metaDate = fullDate; metaStart = 0; metaEnd = 24 * 60;
    } else {
      // hourly
      if (!hourDate || !startTime || !endTime) {
        alert("Please select date, start time and end time for Hourly leave.");
        saveLockRef.current = false;
        return;
      }
      if (endTime <= startTime) {
        alert("End time must be after start time.");
        saveLockRef.current = false;
        return;
      }
      computedDt = `${hourDate}T${startTime}`;
      computedType = `${type} (Hourly ${startTime}-${endTime})`;
      metaDate = hourDate; metaStart = toMinutes(startTime); metaEnd = toMinutes(endTime);
    }

    // Prevent overlapping on the same date with existing local rows
    const newSpan = { date: metaDate, start: metaStart, end: metaEnd };
    const hasOverlap = rows.some((x) => {
      const sp = getLocalRowSpan(x);
      return sp && sp.date === newSpan.date && overlaps({ start: sp.start, end: sp.end }, { start: newSpan.start, end: newSpan.end });
    });
    if (hasOverlap) {
      alert("Duplicate/overlapping leave exists for this date.");
      saveLockRef.current = false;
      return;
    }

    // Prevent duplicate date/time in local list
    const newIso = toIso(computedDt);
    const dup = rows.some((x) => toIso(x.dt) === newIso);
    if (dup) {
      alert("This leave date/time is already added.");
      saveLockRef.current = false;
      return;
    }
    setRows((r) => [...r, { dt: computedDt, type: computedType, reason, mode, date: metaDate, startMinutes: metaStart, endMinutes: metaEnd }]);
    // Reset only specific fields but keep mode and type for quick multiple adds
    if (mode === "full") {
      setFullDate("");
    } else {
      setHourDate("");
      setStartTime("");
      setEndTime("");
    }
    setReason("");
    saveLockRef.current = false;
  }

  async function onSubmit() {
    try {
      // Guard against rapid double-clicks
      if (submitLockRef.current) return;
      submitLockRef.current = true;
      setIsSubmitting(true);
      if (rows.length === 0) {
        alert("No items to submit.");
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
      // Check existing leaves for current user to avoid duplicates
      const existedIso = new Set<string>();
      const existedSpans: Array<{ date: string; start: number; end: number }> = [];
      try {
        const res = await fetch("/api/pa/leave?me=1", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data?.ok) {
          for (const it of (data.rows || [])) {
            const iso = it?.date ? String(it.date) : "";
            if (iso) existedIso.add(iso);
            const sp = getServerRowSpan(it);
            if (sp) existedSpans.push(sp);
          }
        }
      } catch {}

      const skippedDetails: Array<{ date: string; type: string; reason: string }> = [];
      const toSend = rows.filter((r) => {
        const iso = toIso(r.dt);
        if (existedIso.has(iso)) {
          skippedDetails.push({ date: datePartUTC(iso), type: r.type, reason: "duplicate time" });
          return false;
        }
        const spLocal = getLocalRowSpan(r);
        if (!spLocal) return true;
        const hasOverlap = existedSpans.some((sp) => sp.date === spLocal.date && overlaps({ start: sp.start, end: sp.end }, { start: spLocal.start, end: spLocal.end }));
        if (hasOverlap) {
          skippedDetails.push({ date: spLocal.date, type: r.type, reason: "overlap" });
        }
        return !hasOverlap;
      });
      const skipped = rows.length - toSend.length;
      if (toSend.length === 0) {
        setNotice("รายการทั้งหมดถูกข้าม เนื่องจากซ้ำหรือทับซ้อน");
        return;
      }
      if (skipped > 0) {
        const lines = skippedDetails.map((d) => `• ${d.date} – ${d.type} (${d.reason})`).join("\n");
        setNotice(`${skipped} item(s) skipped:\n${lines}`);
      } else {
        setNotice(null);
      }
      // Submit each non-duplicate row to backend (server will enrich with user cookies)
      for (const r of toSend) {
        await fetch("/api/pa/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dt: r.dt, type: r.type, reason: r.reason }),
        });
      }
      alert("Submitted.");
      setRows([]);
      // Reset form
      setMode("full");
      setFullDate("");
      setHourDate("");
      setStartTime("");
      setEndTime("");
      setType("");
      setReason("");
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold">
            Leave
          </h1>
        </div>

        {/* Form */}
        <div className="mt-5 space-y-4">
          {/* Mode toggle */}
          <div>
            <div className="text-sm sm:text-base font-semibold">Leave Duration:</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("full")}
                className={`px-4 h-10 sm:h-11 rounded-full border ${mode === "full" ? "bg-[#BFD9C8] border-black/40" : "bg-white border-black/20"}`}
              >
                Full Day
              </button>
              <button
                type="button"
                onClick={() => setMode("hourly")}
                className={`px-4 h-10 sm:h-11 rounded-full border ${mode === "hourly" ? "bg-[#BFD9C8] border-black/40" : "bg-white border-black/20"}`}
              >
                By Hour
              </button>
            </div>
          </div>

          {/* Date/time inputs per mode */}
          {mode === "full" ? (
            <div>
              <div className="text-sm sm:text-base font-semibold">Date (Full Day):</div>
              <Input
                type="date"
                value={fullDate}
                onChange={(e) => setFullDate(e.target.value)}
                className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-sm sm:text-base font-semibold">Date:</div>
                <Input
                  type="date"
                  value={hourDate}
                  onChange={(e) => setHourDate(e.target.value)}
                  className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
                />
              </div>
              <div>
                <div className="text-sm sm:text-base font-semibold">Start time:</div>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
                />
              </div>
              <div>
                <div className="text-sm sm:text-base font-semibold">End time:</div>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
                />
              </div>
            </div>
          )}

          <div>
            <div className="text-sm sm:text-base font-semibold">ประเภทการลา:</div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60 w-full">
                <SelectValue placeholder="เลือกประเภทการลา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ลาป่วย">ลาป่วย</SelectItem>
                <SelectItem value="ลากิจ">ลากิจ</SelectItem>
                <SelectItem value="ลาพักร้อน">ลาพักร้อน</SelectItem>
                <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-sm sm:text-base font-semibold">Reason:</div>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>

          <div className="flex justify-center">
            <Button
              onClick={onSave}
              className="w-full sm:w-auto rounded-full bg-[#BFD9C8] px-8 text-gray-900 hover:bg-[#b3d0bf] border border-black/20"
            >
              Save
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="mb-2 flex justify-end">
            <Button onClick={exportCsv} variant="outline" className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2">
              Export
            </Button>
          </div>
          <div className="overflow-auto bg-white border border-black/20">
            <Table>
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[160px]">Date/Time</TableHead>
                  <TableHead className="min-w-[140px]">Leave type</TableHead>
                  <TableHead className="min-w-[220px]">Reason</TableHead>
                  <TableHead className="w-[80px] text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      No items yet
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.dt.replace("T", " ")}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{r.type}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{r.reason}</TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => removeRow(i)}
                          title="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
                        >
                          🗑️
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Clear all */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={clearAllRows}
            className="inline-flex h-10 px-4 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50 text-sm"
            title="Clear all"
          >
            Clear all
          </button>
        </div>

        {/* Inline notice placed near submit button */}
        {notice ? (
          <div
            ref={noticeRef}
            aria-live="polite"
            className="mt-6 rounded-md border border-black/20 bg-[#FFF8D6] text-gray-900 px-4 py-3 text-sm whitespace-pre-wrap"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">⚠️</div>
              <div className="flex-1">{notice}</div>
              <button onClick={() => setNotice(null)} className="ml-2 text-gray-700 hover:underline">Dismiss</button>
            </div>
          </div>
        ) : null}

        {/* Submit */}
        <div ref={submitSectionRef} className="mt-4 flex justify-center">
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-full bg-[#E8CC5C] px-10 text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
