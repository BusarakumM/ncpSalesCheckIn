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
  date: string;        // yyyy-mm-dd
  checkin: string;     // HH.mm
  checkout: string;    // HH.mm or ""
  location: string;
  detail: string;
  status: "completed" | "incomplete" | "ongoing";
  name: string;        // sales support name
  email: string;       // for filtering
};

const DATA: Row[] = [
  {
    date: "2025-06-16",
    checkin: "10.00",
    checkout: "11.00",
    location: "โลตัสบางกะปิ",
    detail: "เยี่ยมร้าน",
    status: "completed",
    name: "นาย A",
    email: "a@ncp.co.th",
  },
  {
    date: "2025-06-16",
    checkin: "11.30",
    checkout: "13.21",
    location: "เซเว่น บางรักพลี",
    detail: "เยี่ยมร้าน",
    status: "incomplete",
    name: "นาย B",
    email: "b@ncp.co.th",
  },
  {
    date: "2025-06-16",
    checkin: "13.24",
    checkout: "",
    location: "แม็คโคร บางคูวัด",
    detail: "เยี่ยมร้าน",
    status: "ongoing",
    name: "นาย C",
    email: "c@ncp.co.th",
  },
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
    if (status === "completed") return "bg-[#6EC3A1] text-white";      // green
    if (status === "incomplete") return "bg-[#E9A0A0] text-black";      // red
    return "bg-[#E7D6B9] text-black";                                   // beige (ongoing)
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto max-w-md px-4 pt-4 pb-8">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-2xl font-extrabold">Sales Support Activity</h1>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label>Sales support name</Label>
            <Input
              placeholder="E-mail"
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
          <Button className="rounded-full bg-[#BFD9C8] text-gray-900 hover:bg-[#b3d0bf] border border-black/10">
            Search
          </Button>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="overflow-auto bg-white border border-black/20">
            <Table>
              <TableHeader>
                <TableRow className="[&>*]:bg-[#E0D4B9] [&>*]:text-black">
                  <TableHead className="min-w-[110px]">Date/Time</TableHead>
                  <TableHead>Check-in time</TableHead>
                  <TableHead>Check-out time</TableHead>
                  <TableHead className="min-w-[140px]">Location name</TableHead>
                  <TableHead>Activity detail</TableHead>
                  <TableHead className="min-w-[110px]">Status</TableHead>
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
                        <span className={`inline-flex w-full justify-center rounded px-2 py-1 text-sm font-medium ${rowBg(r.status)}`}>
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
            className="inline-flex w-full items-center justify-center rounded-full bg-[#E8CC5C] px-6 py-3 text-gray-900 hover:bg-[#e3c54a] border border-black/20"
          >
            Back to summary page
          </Link>
        </div>
      </div>
    </div>
  );
}
