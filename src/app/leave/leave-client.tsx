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
    // keep inputs or clear—here we clear reason only (like quick multi add)
    setReason("");
  }

  function onSubmit() {
    // TODO: send to /api/leave
    alert("Submitted (mock).");
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto max-w-md px-4 pt-4 pb-10">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-2xl font-extrabold">Leave</h1>
        </div>

        {/* Form */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Date/Time :</div>
            <Input
              type="datetime-local"
              value={dt}
              onChange={(e) => setDt(e.target.value)}
              className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>

          <div>
            <div className="text-sm font-semibold">Leave Type:</div>
            <Input
              placeholder="ลากิจ / ลาป่วย / ลาพักร้อน …"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>

          <div>
            <div className="text-sm font-semibold">Reason:</div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 min-h-[150px] border-black/10 bg-[#BFD9C8]"
            />
          </div>

          <div className="flex justify-center">
            <Button
              onClick={onSave}
              className="rounded-full bg-[#BFD9C8] px-8 text-gray-900 hover:bg-[#b3d0bf] border border-black/20"
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
                  <TableHead className="min-w-[140px]">Date/Time</TableHead>
                  <TableHead className="min-w-[120px]">Leave type</TableHead>
                  <TableHead>Reason</TableHead>
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
                      <TableCell>{r.type}</TableCell>
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
            className="rounded-full bg-[#E8CC5C] px-10 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
