"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import LogoBadge from "@/components/LogoBadge";
import { listLocalTaskSummaries, syncTaskDraft, type LocalTaskSummary } from "@/lib/localTaskQueue";

type Task = {
  id: string; // encoded stable key for URL
  no: number; // display number
  location: string;
  time?: string; // check-in time HH:mm
  checkout?: string; // checkout time HH:mm
  status: "In Progress" | "Completed" | "Not start yet";
  date: string; // yyyy-mm-dd
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckinClient({ homeHref, email }: { homeHref: string; email: string }) {
  const [qDate, setQDate] = useState<string>(todayUtcDate());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [localDrafts, setLocalDrafts] = useState<LocalTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const statusLabel: Record<Task["status"], string> = {
    "In Progress": "กำลังดำเนินการ",
    Completed: "สำเร็จ",
    "Not start yet": "ยังไม่เริ่ม",
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = { from: qDate, to: qDate, email } as any;
        const res = await fetch('/api/pa/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to load activities'));
        const data = (await res.json()) as { ok: boolean; rows?: Array<{ date: string; location: string; checkin?: string; checkout?: string; status: 'completed' | 'incomplete' | 'ongoing' }> };
        if (!data?.ok) throw new Error('Failed to load activities');
        const mapped: Task[] = (data.rows || []).map((r, i) => ({
          id: typeof window !== 'undefined'
            ? encodeURIComponent(btoa(unescape(encodeURIComponent(`${email || ''}|${r.date}|${r.location || ''}|${r.checkin || ''}`))))
            : String(i + 1),
          no: i + 1,
          location: r.location || 'สถานที่',
          time: r.checkin || '',
          checkout: r.checkout || '',
          date: r.date,
          status: r.status === 'completed' ? 'Completed' : 'In Progress',
        }));
        if (!cancelled) setTasks(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [qDate, email, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadLocalDrafts() {
      try {
        setDraftLoading(true);
        const rows = await listLocalTaskSummaries();
        if (!cancelled) setLocalDrafts(rows);
      } catch (e: any) {
        if (!cancelled) setLocalMessage(e?.message || "โหลดข้อมูลงานในเครื่องไม่สำเร็จ");
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    }
    void loadLocalDrafts();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const filtered = useMemo(() => tasks, [tasks]);
  const readyDrafts = useMemo(() => localDrafts.filter((item) => item.mode === "ready"), [localDrafts]);
  // Allow creating a new task even if there are ongoing ones; enforcement will occur in the New page
  const hasInProgress = useMemo(() => false, []);

  function statusStyles(s: Task["status"]) {
    if (s === "Completed") return "bg-[#6EC3A1] text-white px-2 py-0.5 rounded text-xs sm:text-sm";
    if (s === "In Progress") return "text-gray-800";
    return "text-gray-600 italic";
  }

  function rowBg(s: Task["status"]) {
    if (s === "Completed") return "bg-[#8ac7a9] text-white"; // green highlight like mock
    return "bg-white";
  }

  function formatUpdatedAt(value: number) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  async function handleSyncDraft(key: string) {
    setLocalMessage(null);
    setSyncingKey(key);
    try {
      await syncTaskDraft(key);
      setLocalMessage("ส่งข้อมูลงานที่ค้างไว้สำเร็จแล้ว");
      setReloadKey((value) => value + 1);
    } catch (e: any) {
      setLocalMessage(e?.message || "ส่งข้อมูลงานที่ค้างไว้ไม่สำเร็จ");
    } finally {
      setSyncingKey(null);
    }
  }

  async function handleSyncAll() {
    if (readyDrafts.length === 0) return;
    setLocalMessage(null);
    setSyncingAll(true);
    let success = 0;
    let lastError = "";
    for (const item of readyDrafts) {
      try {
        await syncTaskDraft(item.key);
        success += 1;
      } catch (e: any) {
        lastError = e?.message || "บางรายการส่งไม่สำเร็จ";
      }
    }
    if (success > 0) {
      setLocalMessage(lastError ? `ส่งสำเร็จ ${success} รายการ บางรายการยังไม่สำเร็จ` : `ส่งสำเร็จ ${success} รายการ`);
      setReloadKey((value) => value + 1);
    } else if (lastError) {
      setLocalMessage(lastError);
    }
    setSyncingAll(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="หน้าหลัก"
          >
            <span className="text-xl">🏠</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            บันทึกเข้างาน-ออกงาน
          </h1>
        </div>

        {/* Date + New */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm">วันที่</span>
            <Input
              type="date"
              value={qDate}
              onChange={(e) => setQDate(e.target.value)}
              className="h-9 sm:h-8 w-full sm:w-[190px] rounded-full border-black/10 bg-[#D8CBAF]/60"
            />
          </div>
          <div className="flex sm:block">
            <Link
              href="/checkin/new"
              className={`ml-auto text-base sm:text-lg font-semibold text-[#6EBF8B] hover:opacity-90`}
              title="สร้างรายการใหม่"
            >
              + สร้างใหม่
            </Link>
          </div>
        </div>

        {draftLoading || localDrafts.length > 0 || localMessage ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-[#E9DFC7] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold">งานที่บันทึกไว้ในเครื่อง</div>
                <div className="text-xs text-gray-700">งานส่วนนี้ยังอยู่ในโทรศัพท์เครื่องนี้เท่านั้น</div>
              </div>
              {readyDrafts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleSyncAll()}
                  disabled={syncingAll || !!syncingKey}
                  className="rounded-full border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {syncingAll ? "กำลังส่ง..." : `ส่งทั้งหมด (${readyDrafts.length})`}
                </button>
              ) : null}
            </div>

            {localMessage ? (
              <div className="mt-3 rounded-md border border-black/10 bg-white/80 px-3 py-2 text-sm text-gray-800">
                {localMessage}
              </div>
            ) : null}

            <div className="mt-3 space-y-3">
              {draftLoading ? (
                <div className="text-sm text-gray-700">กำลังโหลดงานที่บันทึกไว้...</div>
              ) : localDrafts.length === 0 ? (
                <div className="text-sm text-gray-700">ยังไม่มีงานที่บันทึกไว้ในเครื่อง</div>
              ) : localDrafts.map((item) => (
                <div key={item.key} className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-base">{item.locationName}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {item.stage === "checkout" ? "งานออกงาน" : "งานเข้างาน"}
                        {item.timeLabel ? ` • ${item.timeLabel}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        บันทึกล่าสุด {formatUpdatedAt(item.updatedAt)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.mode === "ready" ? "bg-[#E8CC5C] text-gray-900" : "bg-[#D9E0DB] text-gray-900"}`}>
                          {item.statusLabel}
                        </span>
                        <span className="text-xs text-gray-700">{item.note}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:min-w-[170px]">
                      <Link
                        href={item.resumeHref}
                        className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        ทำต่อ
                      </Link>
                      {item.mode === "ready" ? (
                        <button
                          type="button"
                          onClick={() => void handleSyncDraft(item.key)}
                          disabled={syncingAll || syncingKey === item.key}
                          className="inline-flex items-center justify-center rounded-full border border-black/20 bg-[#BFD9C8] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-[#b3d0bf] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {syncingKey === item.key ? "กำลังส่ง..." : "ส่งรายการนี้"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* List */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-700">กำลังโหลด...</div>
          ) : error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-700">ไม่มีรายการสำหรับวันนี้</div>
          ) : filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-2xl px-4 py-3 shadow-sm border border-black/10 ${rowBg(t.status)}`}
            >
              {/* Mobile layout (stacked) */}
              <div className="flex sm:hidden items-start gap-3">
                <div className="min-w-[32px] h-8 rounded-md bg-white/70 text-center leading-8 font-semibold text-gray-800">
                  {t.no}
                </div>
              <div className="flex-1">
                <div className="font-medium text-base">{t.location}</div>
                {t.status === 'Completed' && t.time && t.checkout ? (
                  <div className="text-xs text-gray-600 mt-0.5">{t.time} → {t.checkout}</div>
                ) : t.time ? (
                  <div className="text-xs text-gray-600 mt-0.5">{t.time}</div>
                ) : null}
                <div className={`mt-1 ${statusStyles(t.status)}`}>{statusLabel[t.status] || t.status}</div>
                {t.status === 'In Progress' ? (
                  <div className="mt-0.5 text-xs text-red-700">ตำแหน่งนี้ยังไม่ check-out กรุณาทำให้เสร็จก่อน</div>
                ) : null}
              </div>
                <Link
                  href={`/checkin/${t.id}`}
                  className={`self-center inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 hover:bg-gray-50 text-xs font-bold ${t.status === 'Completed' ? 'text-[#2e7d32]' : ''}`}
                  title="เปิดรายการ"
                >
                  ตรวจสอบ
                </Link>
              </div>
              {/* Tablet+ layout (grid) */}
              <div className="hidden sm:grid grid-cols-[36px_1fr_auto] items-center gap-4">
                <div className="text-center font-semibold">{t.no}</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-lg">{t.location}</div>
                    {t.status === 'Completed' && t.time && t.checkout ? (
                      <div className="text-xs text-gray-600 mt-0.5">{t.time} → {t.checkout}</div>
                    ) : t.time ? (
                      <div className="text-xs text-gray-600 mt-0.5">{t.time}</div>
                    ) : null}
                    <div className={`${statusStyles(t.status)}`}>{statusLabel[t.status] || t.status}</div>
                    {t.status === 'In Progress' ? (
                      <div className="mt-0.5 text-xs text-red-700">ตำแหน่งนี้ยังไม่ check-out กรุณาทำให้เสร็จก่อน</div>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/checkin/${t.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 hover:bg-gray-50"
                  title="เปิดรายการ"
                >
                  <span className={`text-xs font-bold ${t.status === 'Completed' ? 'text-[#2e7d32]' : ''}`}>ตรวจสอบ</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom-right logo */}
        <div className="mt-10 flex justify-end">
          <LogoBadge size={110} className="scale-[0.95] sm:scale-100" />
        </div>
      </div>
    </div>
  );
}
