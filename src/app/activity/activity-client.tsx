"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = {
  date: string;
  checkin: string;
  checkout: string;
  location: string;
  detail: string;
  status: "completed" | "incomplete" | "ongoing";
  name: string;
  email: string;
};

const DATA: Row[] = [
  { date: "2025-06-16", checkin: "10.00", checkout: "11.00", location: "โลตัสบางกะปิ", detail: "เยี่ยมร้าน", status: "completed", name: "นาย A", email: "a@ncp.co.th" },
  { date: "2025-06-16", checkin: "11.30", checkout: "13.21", location: "เซเว่น บางรักพลี", detail: "เยี่ยมร้าน", status: "incomplete", name: "นาย B", email: "b@ncp.co.th" },
  { date: "2025-06-16", checkin: "13.24", checkout: "", location: "แม็คโคร บางคูวัด", detail: "เยี่ยมร้าน", status: "ongoing", name: "นาย C", email: "c@ncp.co.th" },
];

export default function ActivityClient({ homeHref }: { homeHref: string }) {
  const [qName, setQName] = useState("");
  const [qDate, setQDate] = useState("");

  const filtered = useMemo(() => {
    return DATA.filter((r) => {
      const nameMatch =
        !qName ||
        r.name.toLowerCase().includes(qName.toLowerCase()) ||
        r.email.toLowerCase().includes(qName.toLowerCase());
      const dateMatch = !qDate || r.date === qDate;
      return nameMatch && dateMatch;
    });
  }, [qName, qDate]);

  function rowBg(status: Row["status"]) {
    if (status === "completed") return "bg-[#6EC3A1] text-white"; // green
    if (status === "incomplete") return "bg-[#E9A0A0] text-black"; // red
    return "bg-[#E7D6B9] text-black"; // beige
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-8 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            Sales Support Activity
          </h1>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Sales support name</Label>
            <Input
              placeholder="Name or e-mail"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              className="bg-white"
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={qDate}
              onChange={(e) => setQDate(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-center">
          <Button className="rounded-full bg-[#BFD9C8] text-gray-900 hover:bg-[#b3d0bf] border border-black/10 px-6 sm:px-10">
            Search
          </Button>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-x-auto bg-white border border-black/20 rounded-md">
            <Table className="min-w-[700px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#E0D4B9] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="min-w-[160px]">Location</TableHead>
                  <TableHead className="min-w-[160px]">Detail</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No results
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {new Date(r.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{r.checkin}</TableCell>
                      <TableCell>{r.checkout || "-"}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell>{r.detail}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex w-full justify-center rounded px-2 py-1 text-sm font-medium ${rowBg(
                            r.status
                          )}`}
                        >
                          {r.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-6 flex justify-center">
          <Link
            href={homeHref}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-[#E8CC5C] px-6 py-3 text-gray-900 hover:bg-[#e3c54a] border border-black/20 text-center"
          >
            Back to summary page
          </Link>
        </div>
      </div>
    </div>
  );
}
