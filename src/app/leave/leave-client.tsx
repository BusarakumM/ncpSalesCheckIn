"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = { dt: string; type: string; reason: string };

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
    // Validate common fields
    if (!type || !reason) {
      alert("Please fill Leave Type and Reason.");
      return;
    }

    let computedDt = "";
    let computedType = type;

    if (mode === "full") {
      if (!fullDate) {
        alert("Please select the date for Full Day leave.");
        return;
      }
      // Use midnight local time for full-day
      computedDt = `${fullDate}T00:00`;
      computedType = `${type} (Full Day)`;
    } else {
      // hourly
      if (!hourDate || !startTime || !endTime) {
        alert("Please select date, start time and end time for Hourly leave.");
        return;
      }
      if (endTime <= startTime) {
        alert("End time must be after start time.");
        return;
      }
      computedDt = `${hourDate}T${startTime}`;
      computedType = `${type} (Hourly ${startTime}-${endTime})`;
    }

    setRows((r) => [...r, { dt: computedDt, type: computedType, reason }]);
    // Reset only specific fields but keep mode and type for quick multiple adds
    if (mode === "full") {
      setFullDate("");
    } else {
      setHourDate("");
      setStartTime("");
      setEndTime("");
    }
    setReason("");
  }

  async function onSubmit() {
    try {
      if (rows.length === 0) return alert("No items to submit.");
      // Submit each row to backend (server will enrich with user cookies)
      for (const r of rows) {
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
            <div className="text-sm sm:text-base font-semibold">Leave Type:</div>
            <Input
              placeholder="ลากิจ / ลาป่วย / ลาพักร้อน …"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>

          <div>
            <div className="text-sm sm:text-base font-semibold">Reason:</div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 min-h-[140px] sm:min-h-[160px] border-black/10 bg-[#BFD9C8]"
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
          <div className="overflow-auto bg-white border border-black/20">
            <Table>
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[160px]">Date/Time</TableHead>
                  <TableHead className="min-w-[140px]">Leave type</TableHead>
                  <TableHead className="min-w-[220px]">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">
                      No items yet
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.dt.replace("T", " ")}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{r.type}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{r.reason}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Export */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

        {/* Submit */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={onSubmit}
            className="w-full sm:w-auto rounded-full bg-[#E8CC5C] px-10 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
