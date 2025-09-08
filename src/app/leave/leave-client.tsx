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
  const [dt, setDt] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");

  // saved rows (local mock)
  const [rows, setRows] = useState<Row[]>([]);

  function onSave() {
    if (!dt || !type || !reason) {
      alert("Please fill Date/Time, Leave Type, and Reason.");
      return;
    }
    setRows((r) => [...r, { dt, type, reason }]);
    setReason("");
  }

  function onSubmit() {
    alert("Submitted (mock).");
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
          <div>
            <div className="text-sm sm:text-base font-semibold">Date/Time :</div>
            <Input
              type="datetime-local"
              value={dt}
              onChange={(e) => setDt(e.target.value)}
              className="mt-1 h-10 sm:h-11 rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>

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
