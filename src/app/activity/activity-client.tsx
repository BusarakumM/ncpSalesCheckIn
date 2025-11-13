"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/utils";

type Row = {
  date: string;
  checkin?: string;
  checkout?: string;
  location: string;
  detail?: string;
  problemDetail?: string;
  jobRemark?: string;
  status: "completed" | "incomplete" | "ongoing";
  name?: string;
  email?: string;
  employeeNo?: string;
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  distanceKm?: number;
};

export default function ActivityClient({ homeHref }: { homeHref: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  type StatusFilter = "" | Row["status"];
  type FilterOverrides = {
    from?: string;
    to?: string;
    district?: string;
    group?: string;
    search?: string;
    status?: StatusFilter;
  };

  const parseStatusParam = (value: string | null): StatusFilter =>
    value === "completed" || value === "incomplete" || value === "ongoing" ? value : "";

  const [qFrom, setQFrom] = useState(() => searchParams.get("from") || "");
  const [qTo, setQTo] = useState(() => searchParams.get("to") || "");
  const [rows, setRows] = useState<Row[]>([]);
  const [qGroup, setQGroup] = useState(() => searchParams.get("group") || "");
  const [qDistrict, setQDistrict] = useState(() => searchParams.get("district") || "");
  const [qSearch, setQSearch] = useState(
    () => searchParams.get("search") || searchParams.get("identity") || searchParams.get("name") || ""
  ); // employeeNo or sales support name
  const [qStatus, setQStatus] = useState<StatusFilter>(() => parseStatusParam(searchParams.get("status")));
  const MAX_KM = parseFloat(process.env.NEXT_PUBLIC_MAX_DISTANCE_KM || "");
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;

  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=160x120&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }

  function formatLatLon(gps?: string) {
    if (!gps) return "";
    const parts = gps.split(",");
    if (parts.length < 2) return gps;
    const lat = parts[0]?.trim();
    const lon = parts[1]?.trim();
    if (!lat || !lon) return gps;
    return `Lat: ${lat}, Lon: ${lon}`;
  }

  const [sortKey, setSortKey] = useState<"date" | "employeeNo" | "username">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [isFiltering, setIsFiltering] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "", label: "ทั้งหมด" },
    { value: "completed", label: "เสร็จสิ้น" },
    { value: "incomplete", label: "ยังไม่เสร็จ" },
    { value: "ongoing", label: "กำลังทำ" },
  ];

  const statusChipStyles: Record<StatusFilter, string> = {
    "": "bg-white text-gray-800",
    completed: "bg-[#BFD9C8] text-gray-900",
    incomplete: "bg-[#E9A0A0] text-gray-900",
    ongoing: "bg-[#F3E099] text-gray-900",
  };
  const statusText: Record<Row["status"], string> = {
    completed: "เสร็จสิ้น",
    incomplete: "ยังไม่เสร็จ",
    ongoing: "กำลังทำ",
  };
  function syncQueryParams(overrides?: FilterOverrides) {
    const params = new URLSearchParams();
    const fromVal = overrides?.from ?? qFrom;
    const toVal = overrides?.to ?? qTo;
    const districtVal = overrides?.district ?? qDistrict;
    const groupVal = overrides?.group ?? qGroup;
    const searchVal = overrides?.search ?? qSearch;
    const statusVal = overrides?.status ?? qStatus;
    if (fromVal) params.set("from", fromVal);
    if (toVal) params.set("to", toVal);
    if (groupVal) params.set("group", groupVal);
    if (districtVal) params.set("district", districtVal);
    if (searchVal) params.set("search", searchVal);
    if (statusVal) params.set("status", statusVal);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function updateStatusFilter(nextStatus: StatusFilter, opts: { sync?: boolean } = {}) {
    setQStatus(nextStatus);
    if (opts.sync === false) return;
    syncQueryParams({ status: nextStatus });
  }

  async function fetchRows(overrides?: FilterOverrides) {
    const payload: any = {};
    const searchVal = (overrides?.search ?? qSearch).trim();
    if (searchVal) {
      if (/^\d+$/.test(searchVal)) payload.employeeNo = searchVal;
      else payload.name = searchVal;
    }
    const fromVal = overrides?.from ?? qFrom;
    if (fromVal) payload.from = fromVal;
    const toVal = overrides?.to ?? qTo;
    if (toVal) payload.to = toVal;
    const districtVal = overrides?.district ?? qDistrict;
    if (districtVal) payload.district = districtVal;
    const groupVal = overrides?.group ?? qGroup;
    if (groupVal) payload.group = groupVal;
    const statusVal = overrides?.status ?? qStatus;
    if (statusVal) payload.status = statusVal;
    const res = await fetch('/api/pa/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load');
    setRows(data.rows as Row[]);
  }

  async function handleApply() {
    setIsFiltering(true);
    try {
      await fetchRows();
      syncQueryParams();
    } catch (err) {
      console.error(err);
    } finally {
      setIsFiltering(false);
    }
  }

  async function handleClear() {
    setIsClearing(true);
    const defaults: Required<FilterOverrides> = {
      from: "",
      to: "",
      district: "",
      group: "",
      search: "",
      status: "" as StatusFilter,
    };
    setQFrom("");
    setQTo("");
    setQDistrict("");
    setQGroup("");
    setQSearch("");
    updateStatusFilter("", { sync: false });
    try {
      await fetchRows(defaults);
      syncQueryParams(defaults);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  }

  function exportCsv() {
    const header = [
      "วันที่","เวลาเข้างาน","เวลาออกงาน","สถานที่","รายละเอียดสถานที่","ปัญหา","หมายเหตุ","เขต","รหัสพนักงาน","ชื่อผู้ใช้","ชื่อเซลส์ซัพพอร์ต","พิกัดเข้า","พิกัดออก","ระยะทาง (กม.)","สถานะ"
    ];
    const lines = rows.map((r) => [
      r.date,
      r.checkin || "-",
      r.checkout || "-",
      r.location || "",
      r.detail || "",
      (r as any).problemDetail || (r as any).problem || "",
      (r as any).jobRemark || (r as any).remark || "",
      r.district || "",
      r.employeeNo || "",
      r.email || "",
      r.name || "",
      r.checkinGps || "",
      r.checkoutGps || "",
      r.distanceKm != null ? r.distanceKm.toFixed(3) : "",
      r.status ? statusText[r.status] : "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => { fetchRows().catch(() => {}); }, []);
  const displayRows = useMemo(() => {
    const filtered = qStatus ? rows.filter((r) => r.status === qStatus) : rows;
    const arr = [...filtered];
    if (sortKey === "employeeNo") {
      arr.sort((a, b) => {
        const av = (a.employeeNo || "").toLowerCase();
        const bv = (b.employeeNo || "").toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else if (sortKey === "username") {
      arr.sort((a, b) => {
        const av = (a.email || "").toLowerCase();
        const bv = (b.email || "").toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return arr;
  }, [rows, sortKey, sortDir, qStatus]);

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
            title="กลับหน้าหลัก"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            กิจกรรมเซลส์ซัพพอร์ต
          </h1>
        </div>

        {/* Status quick filter */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {statusOptions.map(({ value, label }) => {
            const isActive = value === qStatus;
            const palette = statusChipStyles[value];
            const base = "rounded-full border border-black/20 px-4 py-1 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
            const activeClasses = isActive ? `${palette} shadow` : "bg-white text-gray-800 hover:bg-gray-100";
            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => updateStatusFilter(value)}
                className={`${base} ${activeClasses}`}
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          <div>
            <Label className="block mb-1">ช่วงวันที่</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                type="date"
                value={qFrom}
                onChange={(e) => setQFrom(e.target.value)}
                className="bg-white w-full min-w-0"
                placeholder="จากวันที่"
              />
              <Input
                type="date"
                value={qTo}
                onChange={(e) => setQTo(e.target.value)}
                className="bg-white w-full min-w-0"
                placeholder="ถึงวันที่"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>กลุ่ม</Label>
              <Input
                placeholder="ชื่อกลุ่ม"
                value={qGroup}
                onChange={(e) => setQGroup(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <Label>เขต</Label>
              <Input
                placeholder="ชื่อเขต"
                value={qDistrict}
                onChange={(e) => setQDistrict(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <Label>รหัสพนักงานหรือชื่อ</Label>
              <Input
                placeholder="รหัสพนักงาน หรือชื่อ"
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Button
            onClick={handleApply}
            disabled={isFiltering || isClearing}
            title={isFiltering ? "กำลังค้นหา..." : undefined}
            className="rounded-full bg-[#BFD9C8] text-gray-900 hover:bg-[#b3d0bf] border border-black/10 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isFiltering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังค้นหา...
              </>
            ) : (
              "ตกลง"
            )}
          </Button>
          <Button
            onClick={handleClear}
            disabled={isFiltering || isClearing}
            variant="outline"
            className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังล้างค่า...
              </>
            ) : (
              "ล้างทั้งหมด"
            )}
          </Button>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          <div className="mb-2 flex justify-end">
            <Button onClick={exportCsv} variant="outline" className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2">
              ส่งออก
            </Button>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[240px] bg-white border border-black/20 rounded-md">
            <Table className="min-w-[700px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#E0D4B9] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">วันที่</TableHead>
                  <TableHead>เวลาเข้างาน</TableHead>
                  <TableHead>เวลาออกงาน</TableHead>
                  <TableHead className="min-w-[160px]">สถานที่</TableHead>
                  <TableHead className="min-w-[160px]">รายละเอียดสถานที่</TableHead>
                  <TableHead className="min-w-[160px]">ปัญหา</TableHead>
                  <TableHead className="min-w-[160px]">หมายเหตุ</TableHead>
                  <TableHead className="min-w-[140px]">เขต</TableHead>
                  <TableHead className="min-w-[120px] cursor-pointer" title="เรียงตามรหัสพนักงาน" onClick={() => { setSortKey('employeeNo'); setSortDir(sortKey === 'employeeNo' && sortDir === 'asc' ? 'desc' : 'asc'); }}>รหัสพนักงาน</TableHead>
                  <TableHead className="min-w-[180px] cursor-pointer" title="เรียงตามชื่อผู้ใช้" onClick={() => { setSortKey('username'); setSortDir(sortKey === 'username' && sortDir === 'asc' ? 'desc' : 'asc'); }}>ชื่อผู้ใช้</TableHead>
                  <TableHead className="min-w-[180px]">ชื่อเซลส์ซัพพอร์ต</TableHead>
                  <TableHead className="min-w-[180px]">พิกัดเข้า</TableHead>
                  <TableHead className="min-w-[180px]">พิกัดออก</TableHead>
                  <TableHead className="min-w-[120px]">ระยะทาง (กม.)</TableHead>
                  <TableHead className="min-w-[120px]">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-gray-500">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  displayRows.map((r, i) => {
                    const locationGps = r.checkinGps || r.checkoutGps || "";
                    const latLonText = formatLatLon(locationGps);
                    return (
                    <TableRow key={i}>
                      <TableCell title={formatDateDisplay(r.date) === "–" ? "ข้อมูลวันที่ไม่ถูกต้อง" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                      <TableCell>{r.checkin || "-"}</TableCell>
                      <TableCell>{r.checkout || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{r.location || "-"}</div>
                          {(r.checkinAddress || r.checkoutAddress) ? (
                            <div className="text-xs text-gray-700 whitespace-pre-wrap">
                              {r.checkinAddress || r.checkoutAddress}
                            </div>
                          ) : null}
                          {latLonText ? (
                            <div className="text-xs text-gray-600">
                              {latLonText}
                            </div>
                          ) : null}
                          {GMAPS_KEY && locationGps ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mapUrl(locationGps)}
                              alt="แผนที่สถานที่"
                              className="mt-1 h-24 w-auto rounded border border-black/10"
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{r.detail || ""}</TableCell>
                      <TableCell>{(r as any).problemDetail || (r as any).problem || ""}</TableCell>
                      <TableCell>{(r as any).jobRemark || (r as any).remark || ""}</TableCell>
                      <TableCell>{r.district || ""}</TableCell>
                      <TableCell>{r.employeeNo || ""}</TableCell>
                      <TableCell className="truncate" title={r.email || undefined}>{r.email || ""}</TableCell>
                      <TableCell>{r.name || ""}</TableCell>
                      <TableCell>
                        {(r as any).checkinLocation || r.location ? (
                          <div className="text-xs text-gray-700" title={(r as any).checkinLocation || r.location}>
                            สถานที่: {(r as any).checkinLocation || r.location}
                          </div>
                        ) : null}
                        {r.checkinGps ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkinGps)}`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-blue-700 underline">
                            {r.checkinGps}
                          </a>
                        ) : ("")}
                        {/** address if present (added on server) */}
                        {(r as any).checkinAddress ? (
                          <div className="mt-1 text-xs text-gray-700" title={(r as any).checkinAddress}>{(r as any).checkinAddress}</div>
                        ) : null}
                        {r.checkinGps && GMAPS_KEY ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mapUrl(r.checkinGps)} alt="check-in map" className="mt-1 rounded border border-black/10" />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {(r as any).checkoutLocation ? (
                          <div className="text-xs text-gray-700" title={(r as any).checkoutLocation}>
                            สถานที่: {(r as any).checkoutLocation}
                          </div>
                        ) : null}
                        {r.checkoutGps ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkoutGps)}`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-blue-700 underline">
                            {r.checkoutGps}
                          </a>
                        ) : ("")}
                        {(r as any).checkoutAddress ? (
                          <div className="mt-1 text-xs text-gray-700" title={(r as any).checkoutAddress}>{(r as any).checkoutAddress}</div>
                        ) : null}
                        {r.checkoutGps && GMAPS_KEY ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mapUrl(r.checkoutGps)} alt="check-out map" className="mt-1 rounded border border-black/10" />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {r.checkoutGps ? (
                          r.distanceKm != null ? (
                            <span className={MAX_KM && r.distanceKm > MAX_KM ? "text-red-700 font-semibold" : ""}>
                              {r.distanceKm.toFixed(3)}
                              {MAX_KM && r.distanceKm > MAX_KM ? " !" : ""}
                            </span>
                          ) : (
                            ""
                          )
                        ) : (
                          // No checkout GPS to compare
                          "ไม่มีพิกัดออกงาน"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex w-full justify-center rounded px-2 py-1 text-sm font-medium ${rowBg(
                            r.status
                          )}`}
                        >
                          {statusText[r.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/report/summary"
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-[#E8CC5C] px-6 py-3 text-gray-900 hover:bg-[#e3c54a] border border-black/20 text-center"
          >
            กลับไปหน้าสรุป
          </Link>
        </div>
      </div>
    </div>
  );
}


