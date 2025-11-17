"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type Row = { dateTime: string; name: string; email: string; employeeNo?: string; leaveType: string; remark?: string; group?: string };
type SalesSupportUser = { employeeNo: string; name: string; identity: string; group?: string };
type PlanMode = "year" | "multi" | "single";
type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type WeeklyPlanDraft = {
  id: string;
  employees: Array<{ employeeNo: string; name: string }>;
  planMode: PlanMode;
  planYear: string;
  months: string[]; // normalized "MM"
  days: Record<WeekdayKey, boolean>;
  createdAt: string;
};

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
const DAY_CHOICES = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const PLAN_MODE_OPTIONS: Array<{ value: PlanMode; label: string; detail: string }> = [
  { value: "year", label: "Yearly plan", detail: "Use the same weekly days across the selected year." },
  { value: "multi", label: "Select months", detail: "Pick multiple months in the year that share this plan." },
  { value: "single", label: "Specific month", detail: "Apply the plan to one month only." },
];
const MONTH_LABEL_MAP = Object.fromEntries(MONTH_CHOICES.map((m) => [m.value, m.label]));
const WEEKDAY_DEFS: Array<{ key: WeekdayKey; label: string }> = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];
function normalizeUserRecord(raw: unknown): SalesSupportUser | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const employeeNo = typeof obj.employeeNo === "string" ? obj.employeeNo.trim() : "";
  const username = typeof obj.username === "string" ? obj.username.trim() : "";
  const email = typeof obj.email === "string" ? obj.email.trim() : "";
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const group = typeof obj.group === "string" ? obj.group.trim() : undefined;
  const identity = username || email || employeeNo;
  if (!employeeNo || !identity) return null;
  return { employeeNo, name: name || identity, identity, group };
}

function normalizeDayoffRecord(raw: unknown): Row | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const date = typeof obj.date === "string" ? obj.date : "";
  const leaveType = typeof obj.leaveType === "string" ? obj.leaveType : "";
  if (!date || !leaveType) return null;
  return {
    dateTime: date,
    name: typeof obj.name === "string" ? obj.name : "",
    email: typeof obj.email === "string" ? obj.email : "",
    employeeNo: typeof obj.employeeNo === "string" ? obj.employeeNo : "",
    leaveType,
    remark: typeof obj.remark === "string" ? obj.remark : "",
  };
}

function formatDaySummary(days: Record<WeekdayKey, boolean>) {
  const active = WEEKDAY_DEFS.filter((d) => days[d.key]);
  if (active.length === 0) return "No days selected";
  if (active.length === 7) return "Every day";
  return active.map((d) => d.label).join(", ");
}

function summarizeScope(plan: WeeklyPlanDraft) {
  if (plan.planMode === "year" || plan.months.length === 12) return `Year ${plan.planYear}`;
  if (plan.months.length === 0) return `Pending months • ${plan.planYear}`;
  if (plan.months.length === 1) return `${MONTH_LABEL_MAP[plan.months[0]] || plan.months[0]} ${plan.planYear}`;
  const sample = plan.months.slice(0, 3).map((m) => MONTH_LABEL_MAP[m] || m).join(", ");
  return `${plan.months.length} months (${sample}${plan.months.length > 3 ? ", …" : ""}) ${plan.planYear}`;
}

function generateDraftId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function describeEmployees(plan: WeeklyPlanDraft) {
  if (plan.employees.length === 0) return "—";
  if (plan.employees.length === 1) {
    const e = plan.employees[0];
    return `${e.name} (${e.employeeNo})`;
  }
  const [first, ...rest] = plan.employees;
  return `${first.name} (${first.employeeNo}) +${rest.length}`;
}

export default function CalendarClient({ homeHref }: { homeHref: string }) {
  const [selectedGroup, setSelectedGroup] = useState<"" | "GTS" | "MTS">("");
  const [supportDirectory, setSupportDirectory] = useState<Record<string, { name?: string; group?: string }>>({});
  const [dayoffSource, setDayoffSource] = useState<Row[]>([]);
  const [dayoffLoading, setDayoffLoading] = useState(false);
  const [dayoffError, setDayoffError] = useState<string | null>(null);
  const [filterField, setFilterField] = useState<"name" | "employeeNo" | "group">("name");
  const [filterValueInput, setFilterValueInput] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<{ field: "name" | "employeeNo" | "group"; value: string; label?: string } | null>(null);
  const [mon, setMon] = useState(false);
  const [tue, setTue] = useState(false);
  const [wed, setWed] = useState(false);
  const [thu, setThu] = useState(false);
  const [fri, setFri] = useState(false);
  const [sat, setSat] = useState(false);
  const [sun, setSun] = useState(false);
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
  const selectionLimitReached = selectedEmployeeNos.length >= MAX_BULK_SELECTION;
  const hasSelection = selectedSupports.length > 0;
  const [planMode, setPlanMode] = useState<PlanMode>("year");
  const [planYear, setPlanYear] = useState(CURRENT_YEAR.toString());
  const [planMonths, setPlanMonths] = useState<string[]>([CURRENT_MONTH_VALUE]);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [weeklyDrafts, setWeeklyDrafts] = useState<WeeklyPlanDraft[]>([]);
  const [submittingDrafts, setSubmittingDrafts] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayYear, setHolidayYear] = useState(CURRENT_YEAR.toString());
  const [holidayMonth, setHolidayMonth] = useState(CURRENT_MONTH_VALUE);
  const [holidayDay, setHolidayDay] = useState("01");
  const [holidayLeaveType, setHolidayLeaveType] = useState("Holiday");
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [exchangeYear, setExchangeYear] = useState(CURRENT_YEAR.toString());
  const [exchangeMonth, setExchangeMonth] = useState(CURRENT_MONTH_VALUE);
  const [exchangeDay, setExchangeDay] = useState("01");
  const [exchangeLeaveType, setExchangeLeaveType] = useState("Exchange Day-off");
  const [exchangeNote, setExchangeNote] = useState("");
  const [exchangeSaving, setExchangeSaving] = useState(false);

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
  const supportOptions = useMemo(
    () =>
      Object.entries(supportDirectory)
        .map(([employeeNo, meta]) => ({
          employeeNo,
          name: meta.name || employeeNo,
          group: meta.group || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [supportDirectory]
  );
  const enrichedDayoffs = useMemo(() => {
    return dayoffSource.map((item) => {
      const empNo = item.employeeNo || "";
      const directoryInfo = empNo ? supportDirectory[empNo] : undefined;
      return {
        ...item,
        employeeNo: empNo,
        name: item.name || directoryInfo?.name || empNo || item.email || "",
        group: directoryInfo?.group || "",
      };
    });
  }, [dayoffSource, supportDirectory]);
  const filteredDayoffs = useMemo(() => {
    if (!appliedFilter || !appliedFilter.value.trim()) return enrichedDayoffs;
    const term = appliedFilter.value.trim().toLowerCase();
    return enrichedDayoffs.filter((row) => {
      if (appliedFilter.field === "name" || appliedFilter.field === "employeeNo") {
        return (row.employeeNo || "").toLowerCase() === term;
      }
      if (appliedFilter.field === "group") {
        return (row.group || "").toLowerCase() === term;
      }
      return true;
    });
  }, [enrichedDayoffs, appliedFilter]);

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

  function removeWeeklyDraft(id: string) {
    setWeeklyDrafts((prev) => prev.filter((draft) => draft.id !== id));
  }

  async function addCompanyHoliday() {
    if (!selectedSupports.length) {
      alert("Select at least one sales support before adding a company holiday.");
      return;
    }
    if (!holidayName.trim()) {
      alert("Please provide a holiday name.");
      return;
    }
    const day = holidayDay || "01";
    const iso = `${holidayYear || CURRENT_YEAR}-${holidayMonth}-${day}T00:00`;
    setHolidaySaving(true);
    try {
      const newRows: Row[] = [];
      for (const support of selectedSupports) {
        const row: Row = {
          dateTime: iso,
          name: support.name,
          email: support.identity,
          employeeNo: support.employeeNo,
          leaveType: holidayLeaveType || "Holiday",
          remark: `Company holiday: ${holidayName}`,
          group: support.group || supportDirectory[support.employeeNo]?.group,
        };
        await submitDayOff(row);
        newRows.push(row);
      }
      setDayoffSource((prev) => [...newRows, ...prev]);
      setHolidayName("");
      setHolidayLeaveType("Holiday");
      alert(`Added ${newRows.length} holiday day-off entries.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add holiday";
      alert(message);
    } finally {
      setHolidaySaving(false);
    }
  }

  async function addExchangeDayOff() {
    if (!selectedSupports.length) {
      alert("Select at least one sales support before adding an exchange day-off.");
      return;
    }
    const day = exchangeDay || "01";
    const iso = `${exchangeYear || CURRENT_YEAR}-${exchangeMonth}-${day}T00:00`;
    setExchangeSaving(true);
    try {
      const exchangeRows: Row[] = [];
      for (const support of selectedSupports) {
        const row: Row = {
          dateTime: iso,
          name: support.name,
          email: support.identity,
          employeeNo: support.employeeNo,
          leaveType: exchangeLeaveType || "Exchange Day-off",
          remark: exchangeNote ? `Exchange day-off: ${exchangeNote}` : "Exchange day-off",
          group: support.group || supportDirectory[support.employeeNo]?.group,
        };
        await submitDayOff(row);
        exchangeRows.push(row);
      }
      setDayoffSource((prev) => [...exchangeRows, ...prev]);
      setExchangeNote("");
      setExchangeLeaveType("Exchange Day-off");
      alert(`Exchange day-off scheduled for ${exchangeRows.length} sales supports.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add exchange day-off";
      alert(msg);
    } finally {
      setExchangeSaving(false);
    }
  }

  const handleExport = useCallback(() => {
    if (!filteredDayoffs.length) {
      alert("No records to export.");
      return;
    }
    const header = ["Date/Time", "Name", "Employee No", "Group", "Leave Type", "Remark"];
    const rows = filteredDayoffs.map((item) => [
      item.dateTime || "",
      item.name || "",
      item.employeeNo || "",
      item.group || "",
      item.leaveType || "",
      item.remark || "",
    ]);
    const csv = [header, ...rows]
      .map((cols) =>
        cols
          .map((val) => {
            const safe = String(val ?? "").replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-support-dayoff-summary.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredDayoffs]);

  const resetWeeklyDays = useCallback(() => {
    setMon(false);
    setTue(false);
    setWed(false);
    setThu(false);
    setFri(false);
    setSat(false);
    setSun(false);
  }, []);

  const applyWeeklyDays = useCallback((cfg?: { mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean; fri?: boolean; sat?: boolean; sun?: boolean }) => {
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
  }, [resetWeeklyDays]);

  function saveWeeklyDraft() {
    if (!canSaveWeekly) {
      alert("Select sales support and planning scope before saving.");
      return;
    }
    setSavingWeekly(true);
    try {
      const monthsForPlan = planMode === "year" ? MONTH_CHOICES.map((m) => m.value) : normalizedMonths;
      const draft: WeeklyPlanDraft = {
        id: generateDraftId(),
        employees: selectedSupports.map((s) => ({ employeeNo: s.employeeNo, name: s.name })),
        planMode,
        planYear,
        months: monthsForPlan,
        days: { mon, tue, wed, thu, fri, sat, sun },
        createdAt: new Date().toISOString(),
      };
      setWeeklyDrafts((prev) => [draft, ...prev]);
    } finally {
      setSavingWeekly(false);
    }
  }

  async function submitWeeklyDrafts() {
    if (!weeklyDrafts.length) {
      alert("No queued plans to submit.");
      return;
    }
    setSubmittingDrafts(true);
    try {
      for (const draft of weeklyDrafts) {
        const months = draft.planMode === "year" ? MONTH_CHOICES.map((m) => m.value) : (draft.months.length ? draft.months : [CURRENT_MONTH_VALUE]);
        for (const employee of draft.employees) {
          for (const month of months) {
            const effectiveFrom = `${draft.planYear}-${month}-01`;
            const payload = {
              // Backend table expects one row per employee/month with boolean flags for weekly offs
              employeeNo: employee.employeeNo,
              effectiveFrom,
              mon: draft.days.mon,
              tue: draft.days.tue,
              wed: draft.days.wed,
              thu: draft.days.thu,
              fri: draft.days.fri,
              sat: draft.days.sat,
              sun: draft.days.sun,
            };
            const r = await fetch(`/api/pa/calendar/weekly`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok || !data?.ok) throw new Error(data?.error || "Save failed");
          }
        }
      }
      setWeeklyDrafts([]);
      alert("Weekly calendars submitted to backend.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmittingDrafts(false);
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
        const mapped: SalesSupportUser[] = (Array.isArray(data.users) ? data.users : [])
          .map((u) => normalizeUserRecord(u))
          .filter((u): u is SalesSupportUser => Boolean(u));
        setSalesSupports(mapped);
        setSupportDirectory((prev) => {
          const next = { ...prev };
          mapped.forEach((support) => {
            if (!support.employeeNo) return;
            next[support.employeeNo] = { name: support.name, group: support.group || selectedGroup || "" };
          });
          return next;
        });
        setSelectedEmployeeNos((prev) => prev.filter((id) => mapped.some((u) => u.employeeNo === id)));
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load sales support";
        setSupportsError(message);
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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pa/users`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || cancelled) return;
        const next: Record<string, { name?: string; group?: string }> = {};
        (Array.isArray(data.users) ? data.users : []).forEach((u) => {
          const parsed = normalizeUserRecord(u);
          if (!parsed) return;
          next[parsed.employeeNo] = { name: parsed.name, group: parsed.group };
        });
        setSupportDirectory((prev) => ({ ...next, ...prev }));
      } catch {
        // ignore preload errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDayOffSummary() {
      setDayoffLoading(true);
      setDayoffError(null);
      try {
        const from = `${CURRENT_YEAR}-01-01`;
        const to = `${CURRENT_YEAR}-12-31`;
        const res = await fetch(`/api/pa/calendar/dayoff?from=${from}&to=${to}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load day-offs");
        if (cancelled) return;
        const base: Row[] = (Array.isArray(data.dayoffs) ? data.dayoffs : [])
          .map((item) => normalizeDayoffRecord(item))
          .filter((item): item is Row => Boolean(item));
        setDayoffSource(base.sort((a, b) => (a.dateTime > b.dateTime ? -1 : 1)));
      } catch (err: unknown) {
        if (cancelled) return;
        setDayoffError(err instanceof Error ? err.message : "Failed to load day-offs");
      } finally {
        if (!cancelled) setDayoffLoading(false);
      }
    }
    loadDayOffSummary().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!primarySupport) {
      resetWeeklyDays();
      return;
    }
    (async () => {
      const id = primarySupport.employeeNo?.trim();
      if (!id) {
        applyWeeklyDays();
        return;
      }
      try {
        const res = await fetch(`/api/pa/calendar/weekly?employeeNo=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok && data?.config) {
          applyWeeklyDays(data.config);
        } else {
          applyWeeklyDays();
        }
      } catch {
        applyWeeklyDays();
      }
    })();
  }, [primarySupport, applyWeeklyDays, resetWeeklyDays]);

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
                  onClick={saveWeeklyDraft}
                  disabled={!canSaveWeekly || savingWeekly}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 disabled:opacity-60"
                >
                  {savingWeekly ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </span>
                  ) : (
                    "Save Weekly Plan for Review"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Step 4 · Review & submit</p>
                <p className="text-sm text-gray-700">Queued weekly plans are listed below. Review before submitting to the backend.</p>
              </div>
              <Button
                onClick={submitWeeklyDrafts}
                disabled={weeklyDrafts.length === 0 || submittingDrafts}
                className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60"
              >
                {submittingDrafts ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                  </span>
                ) : weeklyDrafts.length ? (
                  `Submit ${weeklyDrafts.length} Plan${weeklyDrafts.length === 1 ? "" : "s"}`
                ) : (
                  "Submit Plans"
                )}
              </Button>
            </div>
            <div className="rounded-md border border-black/10 bg-white overflow-x-auto">
              <Table className="min-w-[720px] text-sm">
                <TableHeader>
                  <TableRow className="[&>*]:bg-[#C6E0CF]">
                    <TableHead>Created</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Weekly day-off</TableHead>
                    <TableHead>Rows to push</TableHead>
                    <TableHead className="w-24 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyDrafts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        No weekly plans saved yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    weeklyDrafts.map((draft) => {
                      const created = new Date(draft.createdAt).toLocaleString();
                      const scope = summarizeScope(draft);
                      const daysSummary = formatDaySummary(draft.days);
                      const monthsCount = draft.planMode === "year" ? 12 : Math.max(draft.months.length, 1);
                      const totalRows = draft.employees.length * monthsCount;
                      return (
                        <TableRow key={draft.id}>
                          <TableCell>{created}</TableCell>
                          <TableCell>{describeEmployees(draft)}</TableCell>
                          <TableCell>{scope}</TableCell>
                          <TableCell>{daysSummary}</TableCell>
                          <TableCell>{totalRows}</TableCell>
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => removeWeeklyDraft(draft.id)}
                              className="text-sm text-red-700 underline-offset-2 hover:underline"
                            >
                              Remove
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Step 5 · Add company holiday</p>
              <p className="text-sm text-gray-700">
                Select month and day for a company holiday and apply it to the sales supports chosen in Step 2.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Holiday name</Label>
                <Input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Songkran, Year end, …" className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <select value={holidayYear} onChange={(e) => setHolidayYear(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {yearOptions.map((year) => (
                    <option key={`${year}-holiday`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Month</Label>
                <select value={holidayMonth} onChange={(e) => setHolidayMonth(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {MONTH_CHOICES.map((m) => (
                    <option key={`holiday-month-${m.value}`} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Day</Label>
                <select value={holidayDay} onChange={(e) => setHolidayDay(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {DAY_CHOICES.map((day) => (
                    <option key={`holiday-day-${day}`} value={day}>
                      {parseInt(day, 10)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label>Leave type</Label>
                <Input value={holidayLeaveType} onChange={(e) => setHolidayLeaveType(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1 flex flex-col justify-end">
                <Button
                  onClick={addCompanyHoliday}
                  disabled={holidaySaving || !selectedSupports.length}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 disabled:opacity-60"
                >
                  {holidaySaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                    </span>
                  ) : (
                    "Add to day-off list"
                  )}
                </Button>
                <p className="text-xs text-gray-600 mt-1">
                  Creates one day-off entry per selected sales support ({selectedSupports.length || 0} currently selected).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Step 6 · Schedule exchange day-off</p>
              <p className="text-sm text-gray-700">
                Use when a sales support swaps their weekly day-off to a specific date (make-up/exchange day). Everyone selected in Step 2 will receive this entry.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Year</Label>
                <select value={exchangeYear} onChange={(e) => setExchangeYear(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {yearOptions.map((year) => (
                    <option key={`exchange-year-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Month</Label>
                <select value={exchangeMonth} onChange={(e) => setExchangeMonth(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {MONTH_CHOICES.map((m) => (
                    <option key={`exchange-month-${m.value}`} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Day</Label>
                <select value={exchangeDay} onChange={(e) => setExchangeDay(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {DAY_CHOICES.map((day) => (
                    <option key={`exchange-day-${day}`} value={day}>
                      {parseInt(day, 10)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Leave type</Label>
                <Input value={exchangeLeaveType} onChange={(e) => setExchangeLeaveType(e.target.value)} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Reason / note</Label>
                <Input value={exchangeNote} onChange={(e) => setExchangeNote(e.target.value)} placeholder="e.g. Swap with Monday due to training" className="bg-white" />
              </div>
              <div className="space-y-1 flex flex-col justify-end">
                <Button
                  onClick={addExchangeDayOff}
                  disabled={exchangeSaving || !selectedSupports.length}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 disabled:opacity-60"
                >
                  {exchangeSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Applying…
                    </span>
                  ) : (
                    "Add exchange day-off"
                  )}
                </Button>
                <p className="text-xs text-gray-600 mt-1">
                  One entry per selected sales support ({selectedSupports.length || 0} currently selected).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none bg-[#BFD9C8]">
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-col gap-1 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Filter day-off summary</p>
              <p className="text-sm text-gray-700">Use these filters to narrow the table below by name, employee number, or group.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Filter by</Label>
                <select value={filterField} onChange={(e) => setFilterField(e.target.value as "name" | "employeeNo" | "group")} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  <option value="name">Sales support name</option>
                  <option value="employeeNo">Employee No</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>{filterField === "group" ? "Select group" : "Select sales support"}</Label>
                {filterField === "group" ? (
                  <select value={filterValueInput} onChange={(e) => setFilterValueInput(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                    <option value="">Select a group</option>
                    <option value="GTS">GTS</option>
                    <option value="MTS">MTS</option>
                  </select>
                ) : (
                  <select
                    value={filterValueInput}
                    onChange={(e) => setFilterValueInput(e.target.value)}
                    className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
                    disabled={supportOptions.length === 0}
                  >
                    <option value="">{supportOptions.length ? "Select a sales support" : "No sales support available"}</option>
                    {supportOptions.map((option) => (
                      <option key={`${filterField}-${option.employeeNo}`} value={option.employeeNo}>
                        {filterField === "employeeNo"
                          ? `${option.employeeNo} — ${option.name}`
                          : `${option.name} (${option.employeeNo})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button
                type="button"
                onClick={() => {
                  const value = filterValueInput.trim();
                  if (!value) {
                    setAppliedFilter(null);
                    loadDayOffSummary().catch(() => {});
                    return;
                  }
                  const label =
                    filterField === "group"
                      ? `Group = ${value}`
                      : (() => {
                          const found = supportOptions.find((opt) => opt.employeeNo === value);
                          return found ? `${found.name} (${found.employeeNo})` : value;
                        })();
                  setAppliedFilter({ field: filterField, value, label });
                  if (filterField === "employeeNo" || filterField === "name") {
                    loadDayOffSummary({ employeeNo: value }).catch(() => {});
                  } else {
                    loadDayOffSummary().catch(() => {});
                  }
                }}
                className="rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20"
              >
                Apply filter
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setFilterValueInput("");
                  setAppliedFilter(null);
                  loadDayOffSummary().catch(() => {});
                }}
                className="rounded-full bg-white border border-black/20 text-gray-800 hover:bg-gray-50"
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* List area: full-width band with fluid inner container */}
      <div className="mt-6 bg-[#BFD9C8]">
        <div className="mx-auto w-full px-4 sm:px-6 md:px-8 py-4 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold">Sales support holiday list</h2>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 self-start sm:self-auto"
            >
              <span>Export excel file</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white">↓</span>
            </button>
          </div>

          <div className="text-xs text-gray-700 mb-2">Download the current filtered results as a CSV.</div>
          {dayoffError && <div className="text-xs text-red-600 mb-2">{dayoffError}</div>}
          <div className="text-xs text-gray-600 mb-3">
            {dayoffLoading
              ? "Loading day-off summary..."
              : `Showing ${filteredDayoffs.length} record${filteredDayoffs.length === 1 ? "" : "s"}.`}
          </div>

          {/* Table wrapper: horizontal scroll on small screens */}
          <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
            <Table className="min-w-[600px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF]">
                  <TableHead className="min-w-[160px]">Date/Time</TableHead>
                  <TableHead className="min-w-[180px]">Sales Support name</TableHead>
                  <TableHead className="min-w-[120px]">Emp No</TableHead>
                  <TableHead className="min-w-[100px]">Group</TableHead>
                  <TableHead className="min-w-[140px]">Leave type</TableHead>
                  <TableHead className="min-w-[200px]">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayoffLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredDayoffs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No items yet. Add above or upload an excel file.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDayoffs.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.dateTime ? r.dateTime.replace("T", " ") : ""}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.employeeNo || ""}</TableCell>
                      <TableCell>{r.group || ""}</TableCell>
                      <TableCell>{r.leaveType}</TableCell>
                      <TableCell>{r.remark ?? ""}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

        </div>
      </div>
    </div>
  );
}
