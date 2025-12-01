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

type Row = { dateTime: string; name: string; email: string; employeeNo?: string; leaveType: string; remark?: string };
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
  { value: "01", label: "ม.ค." },
  { value: "02", label: "ก.พ." },
  { value: "03", label: "มี.ค." },
  { value: "04", label: "เม.ย." },
  { value: "05", label: "พ.ค." },
  { value: "06", label: "มิ.ย." },
  { value: "07", label: "ก.ค." },
  { value: "08", label: "ส.ค." },
  { value: "09", label: "ก.ย." },
  { value: "10", label: "ต.ค." },
  { value: "11", label: "พ.ย." },
  { value: "12", label: "ธ.ค." },
];
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH_VALUE = String(NOW.getMonth() + 1).padStart(2, "0");
const DAY_CHOICES = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const PLAN_MODE_OPTIONS: Array<{ value: PlanMode; label: string; detail: string }> = [
  { value: "year", label: "แผนทั้งปี", detail: "ใช้วันหยุดประจำสัปดาห์ชุดเดียวตลอดทั้งปีที่เลือก" },
  { value: "multi", label: "เลือกหลายเดือน", detail: "เลือกหลายเดือนในปีเดียวกันให้ใช้แผนเดียวกัน" },
  { value: "single", label: "เฉพาะเดือนเดียว", detail: "ใช้แผนนี้กับเดือนเดียวเท่านั้น" },
];
const MONTH_LABEL_MAP = Object.fromEntries(MONTH_CHOICES.map((m) => [m.value, m.label]));
const WEEKDAY_DEFS: Array<{ key: WeekdayKey; label: string }> = [
  { key: "mon", label: "จ." },
  { key: "tue", label: "อ." },
  { key: "wed", label: "พ." },
  { key: "thu", label: "พฤ." },
  { key: "fri", label: "ศ." },
  { key: "sat", label: "ส." },
  { key: "sun", label: "อา." },
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
  if (active.length === 0) return "ยังไม่ได้เลือกวัน";
  if (active.length === 7) return "ทุกวัน";
  return active.map((d) => d.label).join(", ");
}

function summarizeScope(plan: WeeklyPlanDraft) {
  if (plan.planMode === "year" || plan.months.length === 12) return `ปี ${plan.planYear}`;
  if (plan.months.length === 0) return `ยังไม่เลือกเดือน • ${plan.planYear}`;
  if (plan.months.length === 1) return `${MONTH_LABEL_MAP[plan.months[0]] || plan.months[0]} ${plan.planYear}`;
  const sample = plan.months.slice(0, 3).map((m) => MONTH_LABEL_MAP[m] || m).join(", ");
  return `${plan.months.length} เดือน (${sample}${plan.months.length > 3 ? ", …" : ""}) ${plan.planYear}`;
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
  const [filterName, setFilterName] = useState("");
  const [filterEmployeeNo, setFilterEmployeeNo] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
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
  const [refreshingSummary, setRefreshingSummary] = useState(false);
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
        alert(`เลือกได้สูงสุด ${MAX_BULK_SELECTION} คนพร้อมกัน`);
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
  const [holidayLeaveType, setHolidayLeaveType] = useState("วันหยุดบริษัท");
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [exchangeYear, setExchangeYear] = useState(CURRENT_YEAR.toString());
  const [exchangeMonth, setExchangeMonth] = useState(CURRENT_MONTH_VALUE);
  const [exchangeDay, setExchangeDay] = useState("01");
  const [exchangeLeaveType, setExchangeLeaveType] = useState("วันหยุดชดเชย");
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
    if (planMode === "year") return `ใช้กับทั้ง 12 เดือนของปี ${planYear}`;
    if (planMode === "single") {
      const monthLabel = MONTH_CHOICES.find((m) => m.value === normalizedMonths[0])?.label || normalizedMonths[0];
      return `ใช้เฉพาะ ${monthLabel} ${planYear}`;
    }
    if (normalizedMonths.length === 0) return "กรุณาเลือกอย่างน้อยหนึ่งเดือนก่อนดำเนินการต่อ";
    if (normalizedMonths.length === 12) return `ใช้กับทุกเดือนของปี ${planYear}`;
    if (normalizedMonths.length === 1) {
      const monthLabel = MONTH_CHOICES.find((m) => m.value === normalizedMonths[0])?.label || normalizedMonths[0];
      return `เริ่มใช้ตั้งแต่ ${monthLabel} ${planYear}`;
    }
    return `ใช้กับ ${normalizedMonths.length} เดือนในปี ${planYear}`;
  }, [planMode, planYear, normalizedMonths]);
  const canSaveWeekly = hasSelection && (planMode === "year" || normalizedMonths.length > 0);
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
    const nameQuery = filterName.trim().toLowerCase();
    const empQuery = filterEmployeeNo.trim().toLowerCase();
    const groupQuery = filterGroup.trim().toLowerCase();
    return enrichedDayoffs.filter((row) => {
      const nameMatches = nameQuery ? (row.name || "").toLowerCase().includes(nameQuery) : true;
      const empMatches = empQuery ? (row.employeeNo || "").toLowerCase().includes(empQuery) : true;
      const groupMatches = groupQuery ? (row.group || "").toLowerCase().includes(groupQuery) : true;
      return nameMatches && empMatches && groupMatches;
    });
  }, [enrichedDayoffs, filterName, filterEmployeeNo, filterGroup]);

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
      alert("กรุณาเลือกพนักงานซัพพอร์ตก่อนเพิ่มวันหยุดบริษัท");
      return;
    }
    if (!holidayName.trim()) {
      alert("กรุณากรอกชื่อวันหยุด");
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
          leaveType: holidayLeaveType || "วันหยุดบริษัท",
          remark: `วันหยุดบริษัท: ${holidayName}`,
        };
        await submitDayOff(row);
        newRows.push(row);
      }
      setDayoffSource((prev) => [...newRows, ...prev]);
      setHolidayName("");
      setHolidayLeaveType("วันหยุดบริษัท");
      alert(`เพิ่มรายการวันหยุดแล้ว ${newRows.length} รายการ`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "เพิ่มวันหยุดไม่สำเร็จ";
      alert(message);
    } finally {
      setHolidaySaving(false);
    }
  }

  async function addExchangeDayOff() {
    if (!selectedSupports.length) {
      alert("กรุณาเลือกพนักงานซัพพอร์ตก่อนเพิ่มวันหยุดชดเชย");
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
          leaveType: exchangeLeaveType || "วันหยุดชดเชย",
          remark: exchangeNote ? `วันหยุดชดเชย: ${exchangeNote}` : "วันหยุดชดเชย",
        };
        await submitDayOff(row);
        exchangeRows.push(row);
      }
      setDayoffSource((prev) => [...exchangeRows, ...prev]);
      setExchangeNote("");
      setExchangeLeaveType("วันหยุดชดเชย");
      alert(`เพิ่มวันหยุดชดเชยให้ ${exchangeRows.length} คนเรียบร้อย`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เพิ่มวันหยุดชดเชยไม่สำเร็จ";
      alert(msg);
    } finally {
      setExchangeSaving(false);
    }
  }

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

  const fetchDayoffRows = useCallback(async () => {
    const from = `${CURRENT_YEAR}-01-01`;
    const to = `${CURRENT_YEAR}-12-31`;
    const res = await fetch(`/api/pa/calendar/dayoff?from=${from}&to=${to}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || "ไม่สามารถโหลดรายการวันลาได้");
    const base: Row[] = (Array.isArray(data.dayoffs) ? data.dayoffs : [])
      .map((item) => normalizeDayoffRecord(item))
      .filter((item): item is Row => Boolean(item));
    return base.sort((a, b) => (a.dateTime > b.dateTime ? -1 : 1));
  }, []);

  const exportDayoffSummary = useCallback(() => {
    if (!filteredDayoffs.length) {
      alert("ยังไม่มีข้อมูลให้ส่งออก");
      return;
    }
    const header = ["วัน/เวลา", "ชื่อพนักงานซัพพอร์ต", "รหัสพนักงาน", "กลุ่ม", "ประเภทวันลา", "หมายเหตุ"];
    const rows = filteredDayoffs.map((row) => [
      row.dateTime ? row.dateTime.replace("T", " ") : "",
      row.name || "",
      row.employeeNo || "",
      row.group || "",
      row.leaveType || "",
      row.remark || "",
    ]);
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((cols) => cols.map((col) => escapeCell(col || "")).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dayoff-summary.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredDayoffs]);

  const refreshDayoffSummary = useCallback(async () => {
    setRefreshingSummary(true);
    setFilterName("");
    setFilterEmployeeNo("");
    setFilterGroup("");
    setDayoffError(null);
    setDayoffLoading(true);
    try {
      const rows = await fetchDayoffRows();
      setDayoffSource(rows);
    } catch (err: unknown) {
      setDayoffError(err instanceof Error ? err.message : "ไม่สามารถโหลดรายการวันลาได้");
    } finally {
      setDayoffLoading(false);
      setRefreshingSummary(false);
    }
  }, [fetchDayoffRows]);

  function saveWeeklyDraft() {
    if (!canSaveWeekly) {
      alert("กรุณาเลือกพนักงานและช่วงแผนก่อนบันทึก");
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
      alert("ยังไม่มีแผนค้างส่ง");
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
            if (!r.ok || !data?.ok) throw new Error(data?.error || "บันทึกไม่สำเร็จ");
          }
        }
      }
      setWeeklyDrafts([]);
      alert("ส่งแผนวันหยุดรายสัปดาห์ไปยังระบบแล้ว");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "ส่งข้อมูลไม่สำเร็จ");
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
    if (!r.ok || !data?.ok) throw new Error(data?.error || "เพิ่มวันลาไม่สำเร็จ");
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
        if (!res.ok || !data?.ok) throw new Error(data?.error || "ไม่สามารถโหลดรายชื่อพนักงานซัพพอร์ตได้");
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
        const message = err instanceof Error ? err.message : "ไม่สามารถโหลดรายชื่อพนักงานซัพพอร์ตได้";
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
    setDayoffLoading(true);
    setDayoffError(null);
    fetchDayoffRows()
      .then((rows) => {
        if (!cancelled) setDayoffSource(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDayoffError(err instanceof Error ? err.message : "ไม่สามารถโหลดรายการวันลาได้");
      })
      .finally(() => {
        if (!cancelled) setDayoffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDayoffRows]);

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
            title="กลับหน้าหลัก"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold">
            ปฏิทิน
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
              <span className="font-medium">ปฏิทิน GTS</span>
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
              <span className="font-medium">ปฏิทิน MTS</span>
            </div>
          </button>
        </div>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ขั้นตอน 2 · เลือกทีมซัพพอร์ต</p>
            <div className="flex items-center justify-between text-sm text-gray-700">
              <span>
                เลือกแล้ว {selectedEmployeeNos.length}/{MAX_BULK_SELECTION}
              </span>
              {selectedEmployeeNos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeNos([])}
                  className="text-xs text-blue-800 underline-offset-2 hover:underline"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label>พนักงานซัพพอร์ต (เลือกได้สูงสุด {MAX_BULK_SELECTION})</Label>
              <div className="rounded-md border border-black/10 bg-white max-h-64 overflow-y-auto">
                {!selectedGroup ? (
                  <p className="px-3 py-4 text-sm text-gray-500">เลือก GTS หรือ MTS เพื่อโหลดรายชื่อพนักงาน</p>
                ) : supportsLoading ? (
                  <p className="px-3 py-4 text-sm text-gray-500">กำลังดึงรายชื่อพนักงานซัพพอร์ต…</p>
                ) : supportsError ? (
                  <p className="px-3 py-4 text-sm text-red-600">{supportsError}</p>
                ) : salesSupports.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">ไม่พบพนักงานในกลุ่มนี้</p>
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
                    ? `เลือกครบ ${MAX_BULK_SELECTION} คนแล้ว กรุณายกเลิกบางคนเพื่อเพิ่มใหม่`
                    : `เลือกได้สูงสุด ${MAX_BULK_SELECTION} คนเพื่อใช้การตั้งค่าเดียวกัน`
                  : "เลือกกลุ่มเพื่อเริ่มต้น"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly off config (supervisor sets by agent) */}
        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ขั้นตอน 3 · ตั้งวันหยุดประจำสัปดาห์</p>
              <p className="text-sm text-gray-700">
                {selectedSupports.length === 0
                  ? "กรุณาเลือกพนักงานซัพพอร์ตอย่างน้อย 1 คนเพื่อกำหนดวันหยุดประจำสัปดาห์"
                  : selectedSupports.length === 1 && primarySupport
                    ? `แก้ไขตารางให้ ${primarySupport.name} (${primarySupport.employeeNo})`
                    : `อัปเดตให้ ${selectedSupports.length} คนพร้อมกัน`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>ขอบเขตการวางแผน</Label>
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
                <Label>ปี</Label>
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
                  <Label>เดือน</Label>
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
                  <span>เลือกเดือนที่ต้องใช้แผนเดียวกัน</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setPlanMonths(MONTH_CHOICES.map((m) => m.value))}
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setPlanMonths([])}
                    >
                      ล้าง
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
                แผนนี้จะใช้กับทุกเดือนในปี {planYear} ปรับวันหยุดด้านล่างแล้วกดบันทึก
              </p>
            )}
            {planMode !== "year" && (
              <p className="text-xs text-gray-600">{planSummaryText}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1 md:col-span-2">
                <Label>วันหยุดประจำสัปดาห์</Label>
                <div className={`flex flex-wrap gap-3 rounded-md border border-black/10 p-2 ${!hasSelection ? "bg-gray-100" : "bg-white"}`}>
                  {[
                    { k: "จ.", v: mon, s: setMon }, { k: "อ.", v: tue, s: setTue }, { k: "พ.", v: wed, s: setWed },
                    { k: "พฤ.", v: thu, s: setThu }, { k: "ศ.", v: fri, s: setFri }, { k: "ส.", v: sat, s: setSat }, { k: "อา.", v: sun, s: setSun },
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
                      <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก…
                    </span>
                  ) : (
                    "บันทึกแผนรายสัปดาห์ไว้ตรวจสอบ"
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
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ขั้นตอน 4 · ตรวจสอบและส่ง</p>
                <p className="text-sm text-gray-700">ตรวจสอบรายการแผนที่บันทึกไว้ด้านล่างก่อนส่งเข้า backend</p>
              </div>
              <Button
                onClick={submitWeeklyDrafts}
                disabled={weeklyDrafts.length === 0 || submittingDrafts}
                className="rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60"
              >
                {submittingDrafts ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังส่ง…
                  </span>
                ) : weeklyDrafts.length ? (
                  `ส่ง ${weeklyDrafts.length} แผน`
                ) : (
                  "ส่งแผนทั้งหมด"
                )}
              </Button>
            </div>
            <div className="rounded-md border border-black/10 bg-white overflow-x-auto">
              <Table className="min-w-[720px] text-sm">
                <TableHeader>
                  <TableRow className="[&>*]:bg-[#C6E0CF]">
                    <TableHead>สร้างเมื่อ</TableHead>
                    <TableHead>พนักงาน</TableHead>
                    <TableHead>ช่วงที่ใช้</TableHead>
                    <TableHead>วันหยุดประจำสัปดาห์</TableHead>
                    <TableHead>จำนวนแถวที่จะส่ง</TableHead>
                    <TableHead className="w-24 text-center">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyDrafts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        ยังไม่มีแผนที่บันทึก
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
                              ลบ
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
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ขั้นตอน 5 · เพิ่มวันหยุดบริษัท</p>
              <p className="text-sm text-gray-700">
                เลือกเดือนและวันที่ต้องการให้เป็นวันหยุดบริษัท แล้วใช้กับพนักงานที่เลือกในขั้นตอน 2
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>ชื่อวันหยุด</Label>
                <Input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="สงกรานต์, สิ้นปี, …" className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>ปี</Label>
                <select value={holidayYear} onChange={(e) => setHolidayYear(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {yearOptions.map((year) => (
                    <option key={`${year}-holiday`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>เดือน</Label>
                <select value={holidayMonth} onChange={(e) => setHolidayMonth(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {MONTH_CHOICES.map((m) => (
                    <option key={`holiday-month-${m.value}`} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>วันที่</Label>
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
                <Label>ประเภทวันหยุด</Label>
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
                      <Loader2 className="h-4 w-4 animate-spin" /> กำลังเพิ่ม…
                    </span>
                  ) : (
                    "เพิ่มในรายการวันลา"
                  )}
                </Button>
                <p className="text-xs text-gray-600 mt-1">
                  ระบบจะสร้างรายการให้พนักงานแต่ละคน ({selectedSupports.length || 0} คนที่เลือกอยู่)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ขั้นตอน 6 · กำหนดวันหยุดชดเชย</p>
              <p className="text-sm text-gray-700">
                ใช้เมื่อพนักงานต้องการสลับวันหยุดประจำสัปดาห์ไปเป็นวันที่กำหนด ทุกคนที่เลือกในขั้นตอน 2 จะได้รับรายการนี้
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>ปี</Label>
                <select value={exchangeYear} onChange={(e) => setExchangeYear(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {yearOptions.map((year) => (
                    <option key={`exchange-year-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>เดือน</Label>
                <select value={exchangeMonth} onChange={(e) => setExchangeMonth(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {MONTH_CHOICES.map((m) => (
                    <option key={`exchange-month-${m.value}`} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>วันที่</Label>
                <select value={exchangeDay} onChange={(e) => setExchangeDay(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  {DAY_CHOICES.map((day) => (
                    <option key={`exchange-day-${day}`} value={day}>
                      {parseInt(day, 10)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>ประเภทวันหยุด</Label>
                <Input value={exchangeLeaveType} onChange={(e) => setExchangeLeaveType(e.target.value)} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>เหตุผล / หมายเหตุ</Label>
                <Input value={exchangeNote} onChange={(e) => setExchangeNote(e.target.value)} placeholder="เช่น สลับไปหยุดวันจันทร์เพราะมีอบรม" className="bg-white" />
              </div>
              <div className="space-y-1 flex flex-col justify-end">
                <Button
                  onClick={addExchangeDayOff}
                  disabled={exchangeSaving || !selectedSupports.length}
                  className="w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#d2c19e] border border-black/20 disabled:opacity-60"
                >
                  {exchangeSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> กำลังดำเนินการ…
                    </span>
                  ) : (
                    "เพิ่มวันหยุดชดเชย"
                  )}
                </Button>
                <p className="text-xs text-gray-600 mt-1">
                  สร้างให้ทุกคนที่เลือก ({selectedSupports.length || 0} คน)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none bg-[#E0D4B9]">
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-col gap-1 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ขั้นตอน 7 · กรองสรุปรายการลา</p>
              <p className="text-sm text-gray-700">ใช้ตัวกรองเหล่านี้เพื่อลดข้อมูลตามชื่อ รหัส หรือกลุ่ม</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>ชื่อพนักงานซัพพอร์ต</Label>
                <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="ค้นหาด้วยชื่อ" className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>รหัสพนักงาน</Label>
                <Input value={filterEmployeeNo} onChange={(e) => setFilterEmployeeNo(e.target.value)} placeholder="ค้นหาด้วยรหัสพนักงาน" className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label>กลุ่ม</Label>
                <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm">
                  <option value="">ทุกกลุ่ม</option>
                  <option value="GTS">GTS</option>
                  <option value="MTS">MTS</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                onClick={() => {
                  setFilterName("");
                  setFilterEmployeeNo("");
                  setFilterGroup("");
                }}
                className="rounded-full bg-white border border-black/20 text-gray-800 hover:bg-gray-50"
              >
                ล้างตัวกรอง
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* List area: full-width band with fluid inner container */}
      <div className="mt-6 bg-[#BFD9C8]">
        <div className="mx-auto w-full px-4 sm:px-6 md:px-8 py-4 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold">รายการวันหยุดของทีมซัพพอร์ต</h2>

            <button
              type="button"
              onClick={exportDayoffSummary}
              disabled={!filteredDayoffs.length}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
            >
              <span>ส่งออกไฟล์สรุป</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white">↓</span>
            </button>
          </div>

          <div className="text-xs text-gray-700 mb-2">
            {filteredDayoffs.length
              ? `พร้อมส่งออก ${filteredDayoffs.length} รายการตามตัวกรองปัจจุบัน`
              : "ยังไม่มีข้อมูลให้ส่งออก"}
          </div>
          {dayoffError && <div className="text-xs text-red-600 mb-2">{dayoffError}</div>}
          <div className="text-xs text-gray-600 mb-3">
            {dayoffLoading
              ? "กำลังโหลดสรุปรายการลา..."
              : `แสดง ${filteredDayoffs.length} รายการ`}
          </div>

          {/* Table wrapper: horizontal scroll on small screens */}
          <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
            <Table className="min-w-[600px] text-sm">
              <TableHeader>
                <TableRow className="[&>*]:bg-[#C6E0CF]">
                  <TableHead className="min-w-[160px]">วัน/เวลา</TableHead>
                  <TableHead className="min-w-[180px]">ชื่อพนักงานซัพพอร์ต</TableHead>
                  <TableHead className="min-w-[120px]">รหัสพนักงาน</TableHead>
                  <TableHead className="min-w-[100px]">กลุ่ม</TableHead>
                  <TableHead className="min-w-[140px]">ประเภทวันลา</TableHead>
                  <TableHead className="min-w-[200px]">หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayoffLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : filteredDayoffs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      ยังไม่มีข้อมูล เพิ่มรายการด้านบนหรืออัปโหลดไฟล์ Excel
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

          <div className="mt-4">
            <Button
              onClick={refreshDayoffSummary}
              disabled={dayoffLoading || refreshingSummary}
              className="w-full rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60"
            >
              {refreshingSummary ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> กำลังรีเฟรช...
                </span>
              ) : (
                "เริ่มตรวจสอบใหม่"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

