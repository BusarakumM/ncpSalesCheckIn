"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const WEEKDAY_LABELS = ["อา", "จ", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

type CalendarCell = {
  day: number;
  dateKey: string;
  date: Date;
};

type CalendarMarks = {
  dayOff: Record<string, string>;
  leave: Record<string, string>;
  weeklyDays: number[];
  weeklyEffectiveFrom?: string;
};

function formatDateKeyFromParts(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function toDateKey(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatDateKeyFromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export default function SalesSupportCalendar({ employeeNo, email }: { employeeNo?: string; email?: string }) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }),
    []
  );
  const monthLabel = useMemo(() => monthFormatter.format(calendarMonth), [monthFormatter, calendarMonth]);
  const monthInputValue = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = String(calendarMonth.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [calendarMonth]);
  const monthMeta = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const cells: Array<CalendarCell | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        date: new Date(year, month, day),
        dateKey: formatDateKeyFromParts(year, month, day),
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: Array<Array<CalendarCell | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return {
      weeks,
      startIso: formatDateKeyFromParts(year, month, 1),
      endIso: formatDateKeyFromParts(year, month, daysInMonth),
    };
  }, [calendarMonth]);
  const [calendarMarks, setCalendarMarks] = useState<CalendarMarks>({
    dayOff: {},
    leave: {},
    weeklyDays: [],
    weeklyEffectiveFrom: "",
  });
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const todayKey = useMemo(() => {
    const now = new Date();
    return formatDateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const identity = {
    employeeNo: (employeeNo || "").trim(),
    email: (email || "").trim(),
  };
  const hasIdentity = Boolean(identity.employeeNo || identity.email);
  const weeklyDaySet = useMemo(() => new Set(calendarMarks.weeklyDays), [calendarMarks.weeklyDays]);

  useEffect(() => {
    if (!hasIdentity) {
      setCalendarMarks({ dayOff: {}, leave: {}, weeklyDays: [], weeklyEffectiveFrom: "" });
      setCalendarLoading(false);
      setCalendarError(null);
      return;
    }
    let cancelled = false;
    async function loadCalendar() {
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const paramsBase = new URLSearchParams({ from: monthMeta.startIso, to: monthMeta.endIso });
        if (identity.employeeNo) paramsBase.set("employeeNo", identity.employeeNo);
        else if (identity.email) paramsBase.set("email", identity.email);
        const paramsForLeave = new URLSearchParams(paramsBase);
        const weeklyQuery = identity.employeeNo
          ? `employeeNo=${encodeURIComponent(identity.employeeNo)}`
          : identity.email
          ? `email=${encodeURIComponent(identity.email)}`
          : "";
        const [dayoffRes, leaveRes, weeklyRes] = await Promise.all([
          fetch(`/api/pa/calendar/dayoff?${paramsBase.toString()}`, { cache: "no-store" }),
          fetch(`/api/pa/leave?${paramsForLeave.toString()}`, { cache: "no-store" }),
          weeklyQuery ? fetch(`/api/pa/calendar/weekly?${weeklyQuery}`, { cache: "no-store" }) : Promise.resolve(null),
        ]);
        const dayoffJson = await dayoffRes.json();
        if (!dayoffRes.ok || !dayoffJson?.ok) throw new Error(dayoffJson?.error || "Failed to load day-offs");
        const leaveJson = await leaveRes.json();
        if (!leaveRes.ok || !leaveJson?.ok) throw new Error(leaveJson?.error || "Failed to load leaves");
        let weeklyJson: any = { ok: true, config: null };
        if (weeklyRes) {
          const parsedWeekly = await weeklyRes.json();
          if (!weeklyRes.ok || !parsedWeekly?.ok) throw new Error(parsedWeekly?.error || "Failed to load weekly off");
          weeklyJson = parsedWeekly;
        }
        const dayOffMap: Record<string, string> = {};
        (dayoffJson.dayoffs || []).forEach((item: any) => {
          const key = toDateKey(item?.date);
          if (!key) return;
          dayOffMap[key] = item?.leaveType || "Day off";
        });
        const leaveMap: Record<string, string> = {};
        (leaveJson.rows || []).forEach((item: any) => {
          const key = toDateKey(item?.date);
          if (!key) return;
          leaveMap[key] = item?.leaveType || "Leave";
        });
        const weeklyDays: number[] = [];
        let weeklyEffective = "";
        const cfg = weeklyJson?.config;
        if (cfg) {
          if (cfg.sun) weeklyDays.push(0);
          if (cfg.mon) weeklyDays.push(1);
          if (cfg.tue) weeklyDays.push(2);
          if (cfg.wed) weeklyDays.push(3);
          if (cfg.thu) weeklyDays.push(4);
          if (cfg.fri) weeklyDays.push(5);
          if (cfg.sat) weeklyDays.push(6);
          weeklyEffective = toDateKey(cfg.effectiveFrom) || "";
        }
        if (!cancelled) {
          setCalendarMarks({
            dayOff: dayOffMap,
            leave: leaveMap,
            weeklyDays,
            weeklyEffectiveFrom: weeklyEffective,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setCalendarMarks({ dayOff: {}, leave: {}, weeklyDays: [], weeklyEffectiveFrom: "" });
          setCalendarError(err?.message || "ไม่สามารถโหลดปฏิทินได้");
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }
    loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [hasIdentity, identity.email, identity.employeeNo, monthMeta.endIso, monthMeta.startIso]);

  function shiftMonth(delta: number) {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function handleMonthInputChange(value: string) {
    if (!value) return;
    const [yearStr, monthStr] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (Number.isNaN(year) || Number.isNaN(month)) return;
    setCalendarMonth(new Date(year, month - 1, 1));
  }

  return (
    <Card className="border border-black/20 bg-[#F8F2E1] shadow-sm">
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">ปฏิทินการทำงาน</p>
            <p className="text-lg font-bold text-gray-900">{monthLabel}</p>
            <p className="text-xs text-gray-600">
              {hasIdentity
                ? identity.employeeNo
                  ? `ข้อมูลของรหัส ${identity.employeeNo}`
                  : identity.email
                  ? `ข้อมูลของ ${identity.email}`
                  : "กำลังเตรียมข้อมูล..."
                : "ยังไม่พบรหัสพนักงาน"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-700">
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-[#E9A0A0]" />
              <span>วันหยุด</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-[#F3E099]" />
              <span>ลางาน</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-black/10 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="px-3 py-1 text-gray-700 hover:bg-gray-100 rounded-l-full"
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="px-3 py-1 text-gray-700 hover:bg-gray-100 rounded-r-full"
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            เลือกเดือน
            <input
              type="month"
              value={monthInputValue}
              onChange={(e) => handleMonthInputChange(e.target.value)}
              className="rounded-full border border-black/20 px-3 py-1 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EC3A1]"
            />
          </label>
        </div>
        {calendarError ? <div className="mt-3 text-xs text-red-700">{calendarError}</div> : null}
        {calendarLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังโหลดปฏิทิน...
          </div>
        ) : null}
        {!hasIdentity && !calendarLoading ? (
          <div className="mt-4 text-sm text-gray-700">
            กรุณาเข้าสู่ระบบด้วยรหัสพนักงาน เพื่อให้ระบบแสดงวันหยุดและการลา
          </div>
        ) : null}
        {hasIdentity ? (
          <div className="mt-4 space-y-1">
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
            {monthMeta.weeks.map((week, idx) => (
              <div key={`week-${idx}`} className="grid grid-cols-7 gap-1">
                {week.map((cell, dayIdx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}-${dayIdx}`} className="h-16 rounded-2xl bg-transparent" />;
                  }
                  const manualLabel = calendarMarks.dayOff[cell.dateKey];
                  const leaveLabel = calendarMarks.leave[cell.dateKey];
                  const weeklyOff =
                    weeklyDaySet.has(cell.date.getDay()) &&
                    (!calendarMarks.weeklyEffectiveFrom || cell.dateKey >= calendarMarks.weeklyEffectiveFrom);
                  const isDayOff = Boolean(manualLabel || weeklyOff);
                  const variant = isDayOff ? "dayoff" : leaveLabel ? "leave" : "default";
                  const label = manualLabel || (weeklyOff ? "วันหยุดประจำสัปดาห์" : leaveLabel || "");
                  const baseClasses =
                    "flex h-16 flex-col items-center justify-center rounded-2xl border text-xs sm:text-sm transition";
                  const variantClasses =
                    variant === "dayoff"
                      ? "bg-[#E9A0A0]/90 border-[#d67f7f]"
                      : variant === "leave"
                      ? "bg-[#F3E099] border-[#d7be63]"
                      : "bg-white border-black/10";
                  const todayRing = cell.dateKey === todayKey ? "ring-2 ring-[#6EC3A1]" : "";
                  return (
                    <div key={cell.dateKey} className={`${baseClasses} ${variantClasses} ${todayRing}`}>
                      <div className="text-sm font-semibold text-gray-900">{cell.day}</div>
                      {label ? (
                        <div className="mt-0.5 text-[10px] leading-tight text-gray-900 text-center">{label}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
