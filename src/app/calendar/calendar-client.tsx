"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = { dateTime: string; name: string; email: string; employeeNo?: string; leaveType: string; remark?: string };
type Holiday = { date: string; name: string; type?: string };
type SalesSupportUser = { employeeNo: string; name: string; identity: string; group?: string };
type PlanMode = "year" | "multi" | "single";

const MAX_BULK_SELECTION = 10;
const MONTH_CHOICES = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH_VALUE = String(NOW.getMonth() + 1).padStart(2, "0");
const PLAN_MODE_OPTIONS: Array<{ value: PlanMode; label: string; detail: string }> = [
  { value: "year", label: "Yearly plan", detail: "Use the same weekly days across the selected year." },
  { value: "multi", label: "Select months", detail: "Pick multiple months in the year that share this plan." },
  { value: "single", label: "Specific month", detail: "Apply the plan to one month only." },
];

export default function CalendarClient({ homeHref }: { homeHref: string }) {
  const [selectedGroup, setSelectedGroup] = useState<"" | "GTS" | "MTS">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
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
  const [salesSupports, setSalesSupports] = useState<SalesSupportUser[]>([]);
  const [supportsLoading, setSupportsLoading] = useState(false);
  const [supportsError, setSupportsError] = useState<string | null>(null);
  const [selectedEmployeeNos, setSelectedEmployeeNos] = useState<string[]>([]);
  const selectedSupports = useMemo(
    () => salesSupports.filter((u) => selectedEmployeeNos.includes(u.employeeNo)),
    [salesSupports, selectedEmployeeNos]
  );
  function toggleSupportSelection(employeeNo: string) {
    setSelectedEmployeeNos((prev) => {
      if (prev.includes(employeeNo)) {
        return prev.filter((id) => id !== employeeNo);
      }
      if (prev.length >= MAX_BULK_SELECTION) {
        alert(`You can select up to ${MAX_BULK_SELECTION} sales supports at a time.`);
        return prev;
      }
      return [...prev, employeeNo];
    });
  }
  const primarySupport = selectedSupports[0] || null;
  const canEditWeekly = selectedSupports.length === 1 && !!primarySupport;
  const selectionLimitReached = selectedEmployeeNos.length >= MAX_BULK_SELECTION;
  const hasSelection = selectedSupports.length > 0;
  const [planMode, setPlanMode] = useState<PlanMode>("year");
  const [planYear, setPlanYear] = useState(CURRENT_YEAR.toString());
  const [planMonths, setPlanMonths] = useState<string[]>([CURRENT_MONTH_VALUE]);
  const [savingWeekly, setSavingWeekly] = useState(false);

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, idx) => (CURRENT_YEAR - 1 + idx).toString()),
    []
  );
  const normalizedMonths = useMemo(() => {
    if (planMode === "year") return [] as string[];
    if (planMode === "single") {
      const value = planMonths[0] || CURRENT_MONTH_VALUE;
      return [value.padStart(2, "0")];
    }
    const filtered = planMonths.filter(Boolean).map((m) => m.padStart(2, "0"));
    return Array.from(new Set(filtered));
  }, [planMode, planMonths]);
  const effectiveDates = useMemo(() => {
    if (planMode === "year") return [`${planYear}-01-01`];
    return normalizedMonths.map((m) => `${planYear}-${m}-01`);
  }, [planMode, planYear, normalizedMonths]);
  const planSummaryText = useMemo(() => {
    if (planMode === "year") return `Applies to all 12 months of ${planYear}.`;
    if (planMode === "single") {
      const monthLabel = MONTH_CHOICES.find((m) => m.value === normalizedMonths[0])?.label || normalizedMonths[0];
      return `Applies only to ${monthLabel} ${planYear}.`;
    }
    if (normalizedMonths.length === 0) return "Select one or more months to continue.";
    if (normalizedMonths.length === 12) return `Applies to every month of ${planYear}.`;
    if (normalizedMonths.length === 1) {
      const monthLabel = MONTH_CHOICES.find((m) => m.value === normalizedMonths[0])?.label || normalizedMonths[0];
      return `Applies starting ${monthLabel} ${planYear}.`;
    }
    return `Applies to ${normalizedMonths.length} months in ${planYear}.`;
  }, [planMode, planYear, normalizedMonths]);
  const canSaveWeekly = hasSelection && (planMode === "year" || normalizedMonths.length > 0);

  function switchPlanMode(next: PlanMode) {
    setPlanMode(next);
    setPlanMonths((prev) => {
      if (next === "single") return [prev[0] || CURRENT_MONTH_VALUE];
      if (prev.length === 0) return [CURRENT_MONTH_VALUE];
      return prev;
    });
  }

  function togglePlanMonth(value: string) {
    setPlanMonths((prev) => {
      if (planMode === "single") return [value];
      return prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value];
    });
  }

  function buildRows(): Row[] | null {
    if (selectedSupports.length === 0) {
      alert("Please select at least one sales support first.");
      return null;
    }
    if (!dt || !leaveType) {
      alert("Please fill Date/Time and Leave Type.");
      return null;
    }
    const overrideName = name?.trim();
    const overrideEmail = email?.trim();
    const allowEmployeeOverride = selectedSupports.length === 1;
    const overrideEmployeeNo = allowEmployeeOverride ? employeeNo?.trim() : "";
    return selectedSupports.map((support) => ({
      dateTime: dt,
      name: overrideName || support.name,
      email: overrideEmail || support.identity,
      employeeNo: overrideEmployeeNo || support.employeeNo,
      leaveType,
      remark,
    }));
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFileName(f.name);
  }

  function resetWeeklyDays() {
    setMon(false);
    setTue(false);
    setWed(false);
    setThu(false);
    setFri(false);
    setSat(false);
    setSun(false);
  }

  function applyWeeklyDays(cfg?: { mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean; fri?: boolean; sat?: boolean; sun?: boolean }) {
    if (!cfg) {
      resetWeeklyDays();
      return;
    }
    setMon(!!cfg.mon);
    setTue(!!cfg.tue);
    setWed(!!cfg.wed);
    setThu(!!cfg.thu);
    setFri(!!cfg.fri);
    setSat(!!cfg.sat);
    setSun(!!cfg.sun);
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

  async function loadWeekly(target?: string) {
    const id = target?.trim();
    if (!id) return;
    const r = await fetch(`/api/pa/calendar/weekly?employeeNo=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await r.json();
    if (r.ok && data?.ok && data?.config) {
      applyWeeklyDays(data.config);
    } else {
      applyWeeklyDays();
    }
  }

  async function saveWeekly() {
    if (!hasSelection) return alert("Select at least one sales support first.");
    if (effectiveDates.length === 0) return alert("Please choose at least one month or year.");
    setSavingWeekly(true);
    try {
      for (const support of selectedSupports) {
        for (const effectiveFrom of effectiveDates) {
          const r = await fetch(`/api/pa/calendar/weekly`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeNo: support.employeeNo, mon, tue, wed, thu, fri, sat, sun, effectiveFrom }),
          });
          const data = await r.json();
          if (!r.ok || !data?.ok) throw new Error(data?.error || "Save failed");
        }
      }
      const memberText = `${selectedSupports.length} member${selectedSupports.length > 1 ? "s" : ""}`;
      const scopeText =
        planMode === "year"
          ? `the entire ${planYear} calendar`
          : `${effectiveDates.length} month${effectiveDates.length > 1 ? "s" : ""} of ${planYear}`;
      alert(`Weekly calendar saved for ${memberText} across ${scopeText}.`);
    } catch (e: any) {
      alert(e?.message || "Save failed");
    } finally {
      setSavingWeekly(false);
    }
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

  useEffect(() => {
    let cancelled = false;
    if (!selectedGroup) {
      setSalesSupports([]);
      setSelectedEmployeeNos([]);
      setSupportsError(null);
      setSupportsLoading(false);
      return;
    }
    setSupportsLoading(true);
    setSupportsError(null);
    (async () => {
      try {
        const res = await fetch(`/api/pa/users?group=${encodeURIComponent(selectedGroup)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load sales support");
        if (cancelled) return;
        const mapped: SalesSupportUser[] = Array.isArray(data.users)
          ? data.users
              .map((u: any) => ({
                employeeNo: String(u.employeeNo || "").trim(),
                name: String(u.name || "").trim(),
                identity: String(u.username || u.email || "").trim(),
                group: u.group ? String(u.group).trim() : undefined,
              }))
              .filter((u: SalesSupportUser) => u.employeeNo && u.identity)
          : [];
        setSalesSupports(mapped);
        setSelectedEmployeeNos((prev) => prev.filter((id) => mapped.some((u) => u.employeeNo === id)));
      } catch (err: any) {
        if (cancelled) return;
        setSupportsError(err?.message || "Failed to load sales support");
        setSalesSupports([]);
        setSelectedEmployeeNos([]);
      } finally {
        if (!cancelled) setSupportsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  useEffect(() => {
    if (!primarySupport) {
      resetWeeklyDays();
      setName("");
      setEmployeeNo("");
      setEmail("");
      return;
    }
    setName(primarySupport.name);
    setEmployeeNo(primarySupport.employeeNo);
    setEmail(primarySupport.identity);
    loadWeekly(primarySupport.employeeNo).catch(() => {});
  }, [primarySupport]);

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
            onClick={() => setSelectedGroup((prev) => (prev === "GTS" ? "" : "GTS"))}
            className={`rounded-xl px-4 py-3 text-left border ${
              selectedGroup === "GTS" ? "bg-[#BFD9C8] border-black/20" : "bg-white border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selectedGroup === "GTS"} readOnly />
              <span className="font-medium">GTS Calendar</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedGroup((prev) => (prev === "MTS" ? "" : "MTS"))}
            className={`rounded-xl px-4 py-3 text-left border ${
              selectedGroup === "MTS" ? "bg-[#BFD9C8] border-black/20" : "bg-white border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selectedGroup === "MTS"} readOnly />
              <span className="font-medium">MTS Calendar</span>
            </div>
          </button>
        </div>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Step 2 · Select sales support</p>
            <div className="flex items-center justify-between text-sm text-gray-700">
              <span>
                Selected {selectedEmployeeNos.length}/{MAX_BULK_SELECTION}
              </span>
              {selectedEmployeeNos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeNos([])}
                  className="text-xs text-blue-800 underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label>Sales support (up to {MAX_BULK_SELECTION})</Label>
              <div className="rounded-md border border-black/10 bg-white max-h-64 overflow-y-auto">
                {!selectedGroup ? (
                  <p className="px-3 py-4 text-sm text-gray-500">Select GTS or MTS to load sales support.</p>
                ) : supportsLoading ? (
                  <p className="px-3 py-4 text-sm text-gray-500">Fetching sales support…</p>
                ) : supportsError ? (
                  <p className="px-3 py-4 text-sm text-red-600">{supportsError}</p>
                ) : salesSupports.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">No sales support found for this group.</p>
                ) : (
                  <div className="divide-y divide-black/5">
                    {salesSupports.map((support) => {
                      const checked = selectedEmployeeNos.includes(support.employeeNo);
                      const disabled = !checked && selectionLimitReached;
                      return (
                        <label
                          key={support.employeeNo}
                          className={`flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-[#F4F1E4] ${
                            disabled ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold text-gray-900">{support.employeeNo}</span>
                            <span className="text-xs text-gray-600">{support.name}</span>
                          </div>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => toggleSupportSelection(support.employeeNo)}
                            disabled={disabled}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600">
                {selectedGroup
                  ? selectionLimitReached
                    ? `You reached the limit of ${MAX_BULK_SELECTION} selections. Deselect someone to add another.`
                    : `Select up to ${MAX_BULK_SELECTION} members to apply the same action at once.`
                  : "Pick a group to begin."}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly off config (supervisor sets by agent) */}
        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Step 3 · Weekly day-off</p>
              <p className="text-sm text-gray-700">
                {selectedSupports.length === 0
                  ? "Select at least one sales support above to configure their weekly day-off plan."
                  : selectedSupports.length === 1 && primarySupport
                    ? `Editing schedule for ${primarySupport.name} (${primarySupport.employeeNo}).`
                    : `Updating ${selectedSupports.length} sales supports together.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Planning scope</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {PLAN_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => switchPlanMode(opt.value)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      planMode === opt.value ? "border-black/40 bg-white shadow-sm" : "border-black/10 bg-white/60"
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <p className="text-xs text-gray-600">{opt.detail}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Year</Label>
                <select
                  value={planYear}
                  onChange={(e) => setPlanYear(e.target.value)}
                  className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {planMode === "single" && (
                <div className="space-y-1">
                  <Label>Month</Label>
                  <select
                    value={planMonths[0] || CURRENT_MONTH_VALUE}
                    onChange={(e) => setPlanMonths([e.target.value])}
                    className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
                  >
                    {MONTH_CHOICES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {planMode === "multi" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Select the months that should share this weekly plan.</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setPlanMonths(MONTH_CHOICES.map((m) => m.value))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setPlanMonths([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTH_CHOICES.map((month) => {
                    const active = planMonths.includes(month.value);
                    return (
                      <button
                        key={month.value}
                        type="button"
                        onClick={() => togglePlanMonth(month.value)}
                        className={`rounded-md border px-2 py-2 text-sm ${
                          active ? "bg-[#D8CBAF] border-black/40 font-semibold" : "bg-white border-black/10"
                        }`}
                      >
                        {month.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {planMode === "year" && (
              <p className="text-xs text-gray-600">
                Plan will cover every month in {planYear}. Adjust the weekly toggles below and save to apply.
              </p>
            )}
            {planMode !== "year" && (
              <p className="text-xs text-gray-600">{planSummaryText}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1 md:col-span-2">
                <Label>Weekly day-off</Label>
                <div className={`flex flex-wrap gap-3 rounded-md border border-black/10 p-2 ${!hasSelection ? "bg-gray-100" : "bg-white"}`}>
                  {[
                    { k: "Mon", v: mon, s: setMon }, { k: "Tue", v: tue, s: setTue }, { k: "Wed", v: wed, s: setWed },
                    { k: "Thu", v: thu, s: setThu }, { k: "Fri", v: fri, s: setFri }, { k: "Sat", v: sat, s: setSat }, { k: "Sun", v: sun, s: setSun },
                  ].map((d) => (
                    <label key={d.k} className={`inline-flex items-center gap-1 text-sm ${!hasSelection ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={d.v} onChange={(e) => d.s(e.target.checked)} disabled={!hasSelection} /> {d.k}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-3">
                <Button
                  onClick={saveWeekly}
                  disabled={!canSaveWeekly || savingWeekly}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 disabled:opacity-60"
                >
                  {savingWeekly ? "Saving..." : "Save Weekly Calendar"}
                </Button>
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
            <p className="text-sm text-gray-700 mb-4">
              {selectedSupports.length === 0
                ? "Select sales support in Step 2 to add day-off entries."
                : selectedSupports.length === 1
                  ? `Applying for ${selectedSupports[0].name} (${selectedSupports[0].employeeNo}).`
                  : `Applying for ${selectedSupports.length} sales supports at once.`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Sales support name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white"
                  disabled={!canEditWeekly}
                />
              </div>
              <div className="space-y-1">
                <Label>Employee No</Label>
                <Input
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  className="bg-white"
                  disabled={!canEditWeekly}
                />
              </div>
              <div className="space-y-1">
                <Label>Username (optional)</Label>
                <Input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white"
                  disabled={!canEditWeekly}
                />
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
                  disabled={selectedSupports.length === 0}
                  onClick={async () => {
                    const rowsToSubmit = buildRows();
                    if (!rowsToSubmit) return;
                    try {
                      for (const row of rowsToSubmit) {
                        await submitDayOff(row);
                      }
                      setRows((r) => [...rowsToSubmit, ...r]);
                      setLeaveType("");
                      setRemark("");
                      alert(
                        rowsToSubmit.length === 1
                          ? "Day-off added"
                          : `Day-off added for ${rowsToSubmit.length} sales supports`
                      );
                    } catch (e: any) {
                      alert(e?.message || "Failed");
                    }
                  }}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 disabled:opacity-60"
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
