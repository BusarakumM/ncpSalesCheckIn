"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { formatDateDisplay } from "@/lib/utils";
import { useAdaptiveMediaToggle } from "@/hooks/useAdaptiveMediaToggle";
import type { ActivityStatus } from "@/lib/gpsReview";

type Row = {
  id?: string;
  date: string;
  checkin?: string;
  checkinIso?: string;
  checkout?: string;
  checkoutIso?: string;
  location: string;
  detail?: string;
  problemDetail?: string;
  jobRemark?: string;
  reviewNote?: string;
  name?: string;
  group?: string;
  imageIn?: string;
  imageOut?: string;
  status: ActivityStatus;
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  distanceKm?: number;
  remark?: string;
  checkinRowIndex?: number;
  checkoutRowIndex?: number;
};

const DATA: Row[] = [];

const AGENT_MAX_DAYS = 7;

function shiftIsoDate(iso: string, days: number) {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function getAgentRange(todayIso: string) {
  return {
    from: shiftIsoDate(todayIso, -(AGENT_MAX_DAYS - 1)),
    to: todayIso,
  };
}

function clampIsoDate(iso: string, minIso: string, maxIso: string) {
  if (!iso) return "";
  if (iso < minIso) return minIso;
  if (iso > maxIso) return maxIso;
  return iso;
}

function normalizeAgentRange(from: string, to: string, todayIso: string) {
  const allowed = getAgentRange(todayIso);
  let nextFrom = clampIsoDate(from, allowed.from, allowed.to) || allowed.from;
  let nextTo = clampIsoDate(to, allowed.from, allowed.to) || allowed.to;
  if (nextFrom > nextTo) {
    nextTo = nextFrom;
  }
  return { from: nextFrom, to: nextTo, min: allowed.from, max: allowed.to };
}

export default function ReportClient({ homeHref, role, email, todayIso }: { homeHref: string; role?: "SUPERVISOR" | string; email?: string; todayIso: string }) {
  const isSupervisor = role === "SUPERVISOR";
  const initialAgentRange = normalizeAgentRange("", "", todayIso);
  const [from, setFrom] = useState(() => (isSupervisor ? "" : initialAgentRange.from));
  const [to, setTo] = useState(() => (isSupervisor ? "" : initialAgentRange.to));
  const [rows, setRows] = useState<Row[]>([]);
  const [location, setLocation] = useState("");
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [district, setDistrict] = useState("");
  const [allDistricts, setAllDistricts] = useState<string[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ checkin: string; checkout: string; detail: string; problemDetail: string; remark: string }>({
    checkin: "",
    checkout: "",
    detail: "",
    problemDetail: "",
    remark: "",
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const MAX_KM = parseFloat(process.env.NEXT_PUBLIC_MAX_DISTANCE_KM || "");
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const agentLocationEffectReady = useRef(false);
  const supervisorFilterEffectReady = useRef(false);
  const { autoMode, isConstrained, showMedia, toggleShowMedia } = useAdaptiveMediaToggle();
  const mediaToggleTitle = autoMode && isConstrained && !showMedia
    ? "ปิดอัตโนมัติเพื่อประหยัดเน็ตบนมือถือหรือเน็ตช้า"
    : undefined;

  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=160x120&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }
  function statusClass(s: Row["status"]) {
    if (s === "completed") return "bg-[#6EC3A1] text-white";
    if (s === "incomplete") return "bg-[#E9A0A0] text-black";
    if (s === "pending_review") return "bg-[#D8CBAF] text-black";
    return "bg-[#E7D6B9] text-black";
  }

  async function load(override?: { from?: string; to?: string; location?: string; district?: string; group?: string }) {
    const requestedFrom = override?.from ?? from;
    const requestedTo = override?.to ?? to;
    const sendLocation = override?.location ?? location;
    const sendDistrict = override?.district ?? district;
    const sendGroup = override?.group ?? group;
    const range = isSupervisor
      ? { from: requestedFrom, to: requestedTo }
      : normalizeAgentRange(requestedFrom, requestedTo, todayIso);

    if (!isSupervisor) {
      if (range.from !== from) setFrom(range.from);
      if (range.to !== to) setTo(range.to);
    }

    const res = await fetch("/api/pa/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: range.from, to: range.to, location: sendLocation, district: sendDistrict, group: sendGroup }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load report");
    const mapped: Row[] = (data.rows || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      checkin: r.checkin,
      checkinIso: r.checkinIso,
      checkout: r.checkout,
      checkoutIso: r.checkoutIso,
      location: r.location,
      detail: r.detail,
      problemDetail: r.problemDetail ?? r.problem,
      jobRemark: r.jobRemark ?? r.remark,
      reviewNote: r.reviewNote,
      name: r.name,
      group: r.group,
      imageIn: r.imageIn || "",
      imageOut: r.imageOut || r.image || "",
      status: r.status,
      district: r.district,
      checkinGps: r.checkinGps,
      checkoutGps: r.checkoutGps,
      distanceKm: r.distanceKm,
      checkinRowIndex: r.checkinRowIndex,
      checkoutRowIndex: r.checkoutRowIndex,
      remark: (() => {
        const parts: string[] = [];
        if (r.reviewNote) parts.push(`รอตรวจ: ${r.reviewNote}`);
        const d = typeof r.distanceKm === 'number' ? r.distanceKm : null;
        if (d != null && isFinite(d) && MAX_KM && d > MAX_KM) {
          parts.push("Checkout location differs from check-in");
        }
        return parts.join("\n");
      })(),
    }));
    setRows(mapped);
    // Build location dropdown (for non-supervisor: only from own rows)
    try {
      const uniq = Array.from(new Set(mapped.map((r) => r.location).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
      setAllLocations(uniq);
    } catch {}
    // Build district dropdown for supervisors
    try {
      const uniqD = Array.from(new Set(mapped.map((r) => r.district || "").filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
      setAllDistricts(uniqD);
    } catch {}
    // Build group dropdown for supervisors
    try {
      const uniqG = Array.from(new Set(mapped.map((r) => r.group || "").filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
      setAllGroups(uniqG);
    } catch {}
  }

  function clearFilters() {
    const nextFrom = isSupervisor ? "" : initialAgentRange.from;
    const nextTo = isSupervisor ? "" : initialAgentRange.to;
    setFrom(nextFrom);
    setTo(nextTo);
    setLocation("");
    setDistrict("");
    setGroup("");
    setIsFiltering(true);
    load({ from: nextFrom, to: nextTo, location: "", district: "", group: "" })
      .catch(() => {})
      .finally(() => setIsFiltering(false));
  }

  async function handleRefresh() {
    setRefreshing(true);
    setErrorMsg(null);
    try {
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load().catch(() => {}); }, []);

  // Auto-refresh when dropdowns change
  useEffect(() => {
    if (isSupervisor) return;
    if (!agentLocationEffectReady.current) {
      agentLocationEffectReady.current = true;
      return;
    }
    load({ location }).catch(() => {});
  }, [isSupervisor, location]);

  useEffect(() => {
    if (!isSupervisor) return;
    if (!supervisorFilterEffectReady.current) {
      supervisorFilterEffectReady.current = true;
      return;
    }
    load({ district, group }).catch(() => {});
  }, [district, group, isSupervisor]);

  function beginEdit(row: Row) {
    if (!row.id) return;
    setErrorMsg(null);
    setEditingId(row.id);
    setDraft({
      checkin: row.checkin || "",
      checkout: row.checkout || "",
      detail: row.detail || "",
      problemDetail: row.problemDetail || "",
      remark: row.jobRemark || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({ checkin: "", checkout: "", detail: "", problemDetail: "", remark: "" });
  }

  async function saveRow(row: Row) {
    if (!row.id) {
      setErrorMsg("Missing row identifier; cannot save changes.");
      return;
    }
    const hasCheckinTarget = row.checkinRowIndex != null;
    const hasCheckoutTarget = row.checkoutRowIndex != null;
    const checkinVal = (draft.checkin || "").trim() || row.checkin || undefined;
    const checkoutVal = (draft.checkout || "").trim() || row.checkout || undefined;
    const payload = {
      id: row.id,
      date: row.date,
      checkinRowIndex: row.checkinRowIndex,
      checkoutRowIndex: row.checkoutRowIndex,
      checkin: hasCheckinTarget ? checkinVal : undefined,
      checkout: hasCheckoutTarget ? checkoutVal : undefined,
      detail: hasCheckinTarget ? (draft.detail ?? row.detail ?? "") : undefined,
      problemDetail: hasCheckoutTarget ? (draft.problemDetail ?? row.problemDetail ?? "") : undefined,
      remark: hasCheckoutTarget ? (draft.remark ?? row.jobRemark ?? "") : undefined,
    };
    if (!hasCheckinTarget && !hasCheckoutTarget) {
      setErrorMsg("Cannot edit this row because its source rows are missing.");
      return;
    }
    setSavingId(row.id);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/pa/report/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save changes");
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                ...(payload.checkin !== undefined ? { checkin: payload.checkin } : {}),
                ...(payload.checkout !== undefined ? { checkout: payload.checkout } : {}),
                ...(payload.detail !== undefined ? { detail: payload.detail } : {}),
                ...(payload.problemDetail !== undefined ? { problemDetail: payload.problemDetail } : {}),
                ...(payload.remark !== undefined ? { jobRemark: payload.remark } : {}),
              }
            : r
        )
      );
      cancelEdit();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save changes");
    } finally {
      setSavingId(null);
    }
  }

  function exportCsv() {
    // Supervisor export includes Group column before District
    const header = ["Date/Time", "Check-in time", "Check-out time", "Location name", "รายละเอียดสถานที่", "ปัญหา", "หมายเหตุ", "Sales Support Name", "Group", "District", "Check-in GPS", "Check-out GPS", "Distance (km)", "Image Check-in", "Image check-out", "System Remark", "Status"];
    const lines = rows.map((r) => [
      r.date,
      r.checkin,
      r.checkout || "-",
      r.location,
      r.detail,
      r.problemDetail || "",
      r.jobRemark || "",
      r.name || "",
      (r as any).group || "",
      r.district || "",
      r.checkinGps || "",
      r.checkoutGps || "",
      r.distanceKm != null ? r.distanceKm.toFixed(3) : "",
      r.imageIn || "",
      r.imageOut || "",
      r.remark || "",
      r.status,
    ]);
    const csv = [header, ...lines]
      .map(row => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columnCount = role === "SUPERVISOR" ? 18 : 17;
  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    if (e.deltaY === 0) return;
    scrollRef.current.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Header with Home icon */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="Home"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">บันทึกเวลาและการปฏิบัติ (สถานที่)</h1>
        </div>

        {/* Filter */}
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">ตัวกรอง : วันที่</div>
          {!isSupervisor ? (
            <div className="mb-2 text-sm text-gray-700">
              ดูข้อมูลย้อนหลังได้ไม่เกิน 7 วัน เพื่อลดการโหลดข้อมูล
            </div>
          ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="mb-1 block">จากวันที่</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-white"
              min={!isSupervisor ? initialAgentRange.min : undefined}
              max={!isSupervisor ? initialAgentRange.max : undefined}
            />
          </div>
          <div>
            <Label className="mb-1 block">ถึงวันที่</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-white"
              min={!isSupervisor ? initialAgentRange.min : undefined}
              max={!isSupervisor ? initialAgentRange.max : undefined}
            />
          </div>
          {role === "SUPERVISOR" ? (
            <>
              <div>
                <Label className="mb-1 block">กลุ่ม</Label>
                <select value={group} onChange={(e) => setGroup(e.target.value)} className="bg-white w-full h-9 rounded-md border px-2 text-sm">
                  <option value="">All</option>
                  {allGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block">อำเภอ/เขต</Label>
                <select value={district} onChange={(e) => setDistrict(e.target.value)} className="bg-white w-full h-9 rounded-md border px-2 text-sm">
                  <option value="">All</option>
                  {allDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <Label className="mb-1 block">สถานที่</Label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white w-full h-9 rounded-md border px-2 text-sm">
                <option value="">All</option>
                {allLocations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}
        </div>
          <div className="mt-3 flex justify-center gap-3">
            <Button
              onClick={() => { setIsFiltering(true); load().catch(() => {}).finally(() => setIsFiltering(false)); }}
              disabled={isFiltering}
              title={isFiltering ? "กำลังโหลด..." : undefined}
              className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
            >
              {isFiltering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังโหลด...
                </>
              ) : (
                "ตกลง"
              )}
            </Button>
            <Button
              onClick={clearFilters}
              disabled={isFiltering}
              title={isFiltering ? "กำลังโหลด..." : undefined}
              className="rounded-full bg-white text-gray-900 hover:bg-gray-50 border border-black/20 px-6 sm:px-10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
            >
              {isFiltering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ล้างตัวกรอง
                </>
              ) : (
                "ล้างตัวกรอง"
              )}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-md border border-black/20 bg-[#E0D4B9] p-2">
          {role === "SUPERVISOR" ? (
            <div className="mb-2 flex justify-between items-center">
              {errorMsg ? (
                <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded px-3 py-2">
                  {errorMsg}
                </div>
              ) : <div />}
              <div className="flex gap-2">
                <Button
                  onClick={toggleShowMedia}
                  variant="outline"
                  title={mediaToggleTitle}
                  className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2"
                >
                  {showMedia ? "ซ่อนรูป/แผนที่" : "โหลดรูป/แผนที่"}
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing || isFiltering}
                  variant="outline"
                  className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2 disabled:opacity-60"
                >
                  {refreshing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />รีเฟรช</> : "รีเฟรช"}
                </Button>
                <Button onClick={exportCsv} variant="outline" className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2">
                  ส่งออก
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-2 flex justify-between items-center">
              {errorMsg ? (
                <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded px-3 py-2">
                  {errorMsg}
                </div>
              ) : <div />}
              <div className="flex gap-2">
                <Button
                  onClick={toggleShowMedia}
                  variant="outline"
                  title={mediaToggleTitle}
                  className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2"
                >
                  {showMedia ? "ซ่อนรูป/แผนที่" : "โหลดรูป/แผนที่"}
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing || isFiltering}
                  variant="outline"
                  className="rounded-full border-black/20 bg-white hover:bg-gray-50 px-4 py-2 disabled:opacity-60"
                >
                  {refreshing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />รีเฟรช</> : "รีเฟรช"}
                </Button>
              </div>
            </div>
          )}
          <div
            ref={scrollRef}
            onWheel={handleWheelScroll}
            className="relative overflow-x-auto overflow-y-auto max-h-[70vh] bg-white border border-black/20 rounded-md pb-1"
          >
            <Table className="min-w-[1200px] text-sm">
              <TableHeader className="sticky top-0 z-20 bg-[#C6E0CF]">
                <TableRow className="[&>*]:bg-[#C6E0CF] [&>*]:text-black">
                  <TableHead className="min-w-[120px]">วัน/เวลา</TableHead>
                  <TableHead className="min-w-[120px]">Check-in</TableHead>
                  <TableHead className="min-w-[120px]">Check-out</TableHead>
                  <TableHead className="min-w-[160px]">ชื่อสถานที่</TableHead>
                  <TableHead className="min-w-[180px]">รายละเอียดสถานที่</TableHead>
                  <TableHead className="min-w-[180px]">ปัญหา</TableHead>
                  <TableHead className="min-w-[180px]">หมายเหตุ</TableHead>
                  <TableHead className="min-w-[180px]">ชื่อเซลส์ซัพพอร์ต</TableHead>
                  <TableHead className="min-w-[140px]">กลุ่ม</TableHead>
                  <TableHead className="min-w-[140px]">อำเภอ/เขต</TableHead>
                  <TableHead className="min-w-[180px]">พิกัดเข้า</TableHead>
                  <TableHead className="min-w-[180px]">พิกัดออก</TableHead>
                  <TableHead className="min-w-[120px]">ระยะทาง (กม.)</TableHead>
                  <TableHead className="min-w-[160px]">รูปเข้างาน</TableHead>
                  <TableHead className="min-w-[160px]">รูปออกงาน</TableHead>
                  <TableHead className="min-w-[220px]">Remark</TableHead>
                  <TableHead className="min-w-[120px]">สถานะ</TableHead>
                  {role === "SUPERVISOR" ? <TableHead className="min-w-[140px] text-center">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="text-center text-gray-500">
                      No data for the selected range
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => {
                    const isEditing = editingId === r.id;
                    return (
                      <TableRow key={r.id || i}>
                        <TableCell title={formatDateDisplay(r.date) === "–" ? "Missing or invalid date" : undefined}>{formatDateDisplay(r.date)}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input type="time" value={draft.checkin} onChange={(e) => setDraft({ ...draft, checkin: e.target.value })} className="h-9 bg-white" />
                          ) : (
                            r.checkin
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input type="time" value={draft.checkout} onChange={(e) => setDraft({ ...draft, checkout: e.target.value })} className="h-9 bg-white" />
                          ) : (
                            r.checkout || "-"
                          )}
                        </TableCell>
                        <TableCell title={[r.checkinGps, r.checkoutGps].filter(Boolean).join(' | ') || undefined}>{r.location}</TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          {isEditing ? (
                            <textarea
                              value={draft.detail}
                              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                              className="w-full min-h-[60px] rounded border border-black/20 px-2 py-1 text-sm"
                            />
                          ) : (
                            r.detail
                          )}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          {isEditing ? (
                            <textarea
                              value={draft.problemDetail}
                              onChange={(e) => setDraft({ ...draft, problemDetail: e.target.value })}
                              className="w-full min-h-[60px] rounded border border-black/20 px-2 py-1 text-sm"
                            />
                          ) : (
                            r.problemDetail || ""
                          )}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          {isEditing ? (
                            <textarea
                              value={draft.remark}
                              onChange={(e) => setDraft({ ...draft, remark: e.target.value })}
                              className="w-full min-h-[60px] rounded border border-black/20 px-2 py-1 text-sm"
                            />
                          ) : (
                            r.jobRemark || ""
                          )}
                        </TableCell>
                        <TableCell>{r.name || ""}</TableCell>
                        <TableCell>{(r as any).group || ""}</TableCell>
                        <TableCell>{r.district || ""}</TableCell>
                        <TableCell>
                          {r.checkinGps ? (
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkinGps)}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                              {r.checkinGps}
                            </a>
                          ) : ("")}
                          {(r as any).checkinAddress ? (
                            <div className="mt-1 text-xs text-gray-700" title={(r as any).checkinAddress}>{(r as any).checkinAddress}</div>
                          ) : null}
                          {showMedia && r.checkinGps && GMAPS_KEY ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mapUrl(r.checkinGps)} alt="check-in map" loading="lazy" decoding="async" className="mt-1 rounded border border-black/10" />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {r.checkoutGps ? (
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(r.checkoutGps)}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                              {r.checkoutGps}
                            </a>
                          ) : ("")}
                          {(r as any).checkoutAddress ? (
                            <div className="mt-1 text-xs text-gray-700" title={(r as any).checkoutAddress}>{(r as any).checkoutAddress}</div>
                          ) : null}
                          {showMedia && r.checkoutGps && GMAPS_KEY ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mapUrl(r.checkoutGps)} alt="check-out map" loading="lazy" decoding="async" className="mt-1 rounded border border-black/10" />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {r.distanceKm != null ? (
                            <span className={MAX_KM && r.distanceKm > MAX_KM ? "text-red-700 font-semibold" : ""}>
                              {r.distanceKm.toFixed(3)}
                              {MAX_KM && r.distanceKm > MAX_KM ? " !" : ""}
                            </span>
                          ) : ""}
                        </TableCell>
                        <TableCell>
                          {r.imageIn ? (
                            <a href={r.imageIn} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                              {showMedia ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={r.imageIn} alt="check-in" loading="lazy" decoding="async" className="mt-1 h-20 w-auto rounded border border-black/10" />
                                </>
                              ) : (
                                "เปิดรูป"
                              )}
                            </a>
                          ) : ("")}
                        </TableCell>
                        <TableCell>
                          {r.imageOut ? (
                            <a href={r.imageOut} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                              {showMedia ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={r.imageOut} alt="check-out" loading="lazy" decoding="async" className="mt-1 h-20 w-auto rounded border border-black/10" />
                                </>
                              ) : (
                                "เปิดรูป"
                              )}
                            </a>
                          ) : ("")}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">{r.remark || ""}</TableCell>
                        <TableCell>
                          <span className={`inline-flex w-full justify-center rounded px-2 py-1 text-sm font-medium ${statusClass(r.status)}`}>
                            {r.status === 'completed' ? 'เสร็จสิ้น' : r.status === 'incomplete' ? 'ไม่เสร็จ' : r.status === 'pending_review' ? 'รอตรวจ' : 'กำลังทำ'}
                          </span>
                        </TableCell>
                        {role === "SUPERVISOR" ? (
                          <TableCell>
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveRow(r)}
                                  disabled={savingId === r.id}
                                  className="w-full rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] disabled:opacity-60"
                                >
                                  {savingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                  disabled={savingId === r.id}
                                  className="w-full rounded-full border-black/20 bg-white hover:bg-gray-50"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => beginEdit(r)}
                                disabled={!r.id || savingId != null}
                                className="w-full rounded-full bg-white text-gray-900 hover:bg-gray-50 border border-black/20 disabled:opacity-60"
                              >
                                Edit
                              </Button>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Export moved above table for consistency */}
      </div>
    </div>
  );
}









